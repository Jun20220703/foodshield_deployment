import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { FoodService, Food } from '../../services/food.service';
import { BrowseFoodService, MarkedFood } from '../../services/browse-food.service';

interface DayInfo {
  name: string;
  date: number;
  fullDate: Date;
  isCurrentMonth: boolean; // 현재 표시 중인 달인지 여부
  isToday: boolean; // 오늘 날짜인지 여부
  isPast: boolean; // 지난 날짜인지 여부
}

interface MonthYear {
  month: number;
  year: number;
}

interface InventoryItem {
  foodId: string; // Food ID to identify same food items
  name: string;
  quantity: number;
  category: string;
  marked: boolean;
  markedQuantity: number; // Amount that is marked
  expiry: string;
}

interface MealPlan {
  dateKey: string; // YYYY-MM-DD 형식
  mealType: string; // Breakfast, Lunch, Dinner, Snack
  mealName: string;
  ingredients?: string[];
}

@Component({
  selector: 'app-plan-weekly-meal',
  standalone: true,
  templateUrl: './planWeeklyMeal.component.html',
  styleUrls: ['./planWeeklyMeal.component.css'],
  imports: [CommonModule, FormsModule, SidebarComponent]
})
export class PlanWeeklyMealComponent implements OnInit {
  currentMonth: string = 'September';
  weekDays: DayInfo[] = [];
  mealTypes: string[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
  currentDate: Date = new Date(); // Track the current calendar date
  targetMonth: number = new Date().getMonth(); // 현재 표시 중인 달의 인덱스
  targetYear: number = new Date().getFullYear(); // 현재 표시 중인 달의 연도
  
  searchTerm: string = '';
  selectedItemIndex: number = -1;
  
  // Meal planning data
  mealPlans: Map<string, MealPlan> = new Map(); // key: "YYYY-MM-DD-mealType"
  selectedDay: DayInfo | null = null;
  selectedMealType: string | null = null;
  showMealOptions: boolean = false;
  
  inventory: InventoryItem[] = [];
  filteredInventory: InventoryItem[] = [];
  
  // Pagination
  itemsPerPage: number = 5;
  currentPage: number = 1;
  paginatedInventory: InventoryItem[] = [];
  totalPages: number = 1;

  // Filter
  showFilter: boolean = false;
  selectedCategories: Set<string> = new Set();
  expiryFilterDays: number | null = null; // null = no filter, number = days until expiry
  availableCategories: string[] = []; // Will be populated from actual inventory data

  constructor(
    private cdr: ChangeDetectorRef,
    private router: Router,
    private foodService: FoodService,
    private browseService: BrowseFoodService
  ) {}

  ngOnInit() {
    // currentDate를 주의 시작점(일요일)로 설정
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - currentDay); // 일요일로 이동
    this.currentDate = new Date(startOfWeek);
    
    // targetMonth와 targetYear를 현재 달로 설정
    this.targetMonth = today.getMonth();
    this.targetYear = today.getFullYear();
    
    this.initializeWeekDays();
    this.loadInventory();
  }

  loadInventory() {
    // SSR 환경 방어: 브라우저 환경에서만 실행
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      console.warn('⚠️ localStorage not available (SSR mode). Skipping inventory load.');
      this.inventory = [];
      this.filteredInventory = [];
      return;
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user.id;

    if (!userId) {
      console.error('User ID not found in localStorage.');
      this.inventory = [];
      this.filteredInventory = [];
      return;
    }

    // Load only marked foods
    this.browseService.getMarkedFoods().subscribe({
      next: (markedFoods: MarkedFood[]) => {
        console.log('📌 Loaded marked foods:', markedFoods);
        
        // Convert marked foods to InventoryItem format
        const markedItems = markedFoods.map((markedFood: MarkedFood) => {
          let expiryStr = '';
          if (markedFood.expiry) {
            const expiryDate = new Date(markedFood.expiry);
            const day = String(expiryDate.getDate()).padStart(2, '0');
            const month = String(expiryDate.getMonth() + 1).padStart(2, '0');
            const year = expiryDate.getFullYear();
            expiryStr = `${day}/${month}/${year}`;
          }

          return {
            foodId: markedFood.foodId || '',
            name: markedFood.name,
            quantity: markedFood.qty,
            category: markedFood.category || 'Other',
            marked: true,
            markedQuantity: markedFood.qty,
            expiry: expiryStr
          };
        });

        // Merge marked items with same foodId (same food item marked multiple times)
        const markedItemsByFoodId = new Map<string, InventoryItem>();
        markedItems.forEach(item => {
          const foodId = item.foodId;
          if (!foodId) {
            // If no foodId, skip or handle separately
            return;
          }
          
          const existing = markedItemsByFoodId.get(foodId);
          if (existing) {
            // If same foodId exists, add quantities (same food item marked multiple times)
            existing.quantity += item.quantity;
            existing.markedQuantity += item.markedQuantity;
          } else {
            // Add new item
            markedItemsByFoodId.set(foodId, { ...item });
          }
        });

        this.inventory = Array.from(markedItemsByFoodId.values());
        this.updateAvailableCategories(); // Update available categories from actual data
        this.applyFilters(); // Apply filters on initial load
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading marked foods:', err);
        this.inventory = [];
        this.filteredInventory = [];
        this.availableCategories = [];
        this.applyFilters(); // Apply filters even on error
        this.cdr.detectChanges();
      }
    });
  }

  initializeWeekDays() {
    // currentDate는 항상 주의 시작점(일요일)을 가리킴
    const startOfWeek = new Date(this.currentDate);
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // 오늘 날짜 확인
    const today = new Date();
    today.setHours(0, 0, 0, 0); // 시간을 00:00:00으로 설정하여 날짜만 비교
    
    this.weekDays = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      day.setHours(0, 0, 0, 0); // 시간을 00:00:00으로 설정하여 날짜만 비교
      
      // 현재 표시 중인 달(targetMonth)과 일치하는지 확인
      const isCurrentMonth = day.getMonth() === this.targetMonth && day.getFullYear() === this.targetYear;
      
      // 오늘 날짜인지 확인
      const isToday = day.getTime() === today.getTime();
      
      // 지난 날짜인지 확인 (오늘 이전)
      const isPast = day.getTime() < today.getTime();
      
      this.weekDays.push({
        name: dayNames[day.getDay()],
        date: day.getDate(),
        fullDate: day,
        isCurrentMonth: isCurrentMonth,
        isToday: isToday,
        isPast: isPast
      });
    }
    
    // Update month name based on targetMonth (set by month arrows or day navigation)
    this.currentMonth = new Date(this.targetYear, this.targetMonth, 1).toLocaleString('default', { month: 'long' });
  }

  previousWeek() {
    const newDate = new Date(this.currentDate);
    newDate.setDate(newDate.getDate() - 7);
    this.currentDate = newDate;
    this.initializeWeekDays();
    this.cdr.detectChanges();
  }

  nextWeek() {
    const newDate = new Date(this.currentDate);
    newDate.setDate(newDate.getDate() + 7);
    this.currentDate = newDate;
    this.initializeWeekDays();
    this.cdr.detectChanges();
  }

  previousMonth(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // 현재 달 기준으로 이전 달 계산
    const currentMonth = this.targetMonth;
    const currentYear = this.targetYear;
    
    // 이전 달 계산
    const newMonth = currentMonth - 1;
    const newYear = newMonth < 0 ? currentYear - 1 : currentYear;
    const actualNewMonth = newMonth < 0 ? 11 : newMonth;
    
    // 현재 주의 이전 주를 계산 (끊긴 곳부터 이어지게)
    const prevWeekDate = new Date(this.currentDate);
    prevWeekDate.setDate(prevWeekDate.getDate() - 7);
    
    // 이전 주가 이전 달에 속하는지 확인
    const prevWeekMonth = prevWeekDate.getMonth();
    const prevWeekYear = prevWeekDate.getFullYear();
    
    // 이전 주가 이전 달에 속하면 그 주를 표시, 아니면 이전 달의 첫 주를 표시
    if (prevWeekMonth === actualNewMonth && prevWeekYear === newYear) {
      // 끊긴 곳부터 이어지기
      this.currentDate = new Date(prevWeekDate);
      this.targetMonth = actualNewMonth;
      this.targetYear = newYear;
    } else {
      // 이전 달의 첫 주를 표시
      const firstDayOfMonth = new Date(newYear, actualNewMonth, 1);
      const dayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
      const startOfWeek = new Date(firstDayOfMonth);
      startOfWeek.setDate(firstDayOfMonth.getDate() - dayOfWeek); // 일요일로 이동
      
      this.currentDate = new Date(startOfWeek);
      this.targetMonth = actualNewMonth;
      this.targetYear = newYear;
    }
    
    // initializeWeekDays 호출 (targetMonth가 이미 설정되어 있음)
    this.initializeWeekDays();
    
    this.cdr.detectChanges();
  }

  nextMonth(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // 현재 달 기준으로 다음 달 계산
    const currentMonth = this.targetMonth;
    const currentYear = this.targetYear;
    
    // 다음 달 계산
    const newMonth = currentMonth + 1;
    const newYear = newMonth > 11 ? currentYear + 1 : currentYear;
    const actualNewMonth = newMonth > 11 ? 0 : newMonth;
    
    // 현재 주의 다음 주를 계산 (끊긴 곳부터 이어지게)
    const nextWeekDate = new Date(this.currentDate);
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    
    // 다음 주가 다음 달에 속하는지 확인
    const nextWeekMonth = nextWeekDate.getMonth();
    const nextWeekYear = nextWeekDate.getFullYear();
    
    // 다음 주가 다음 달에 속하면 그 주를 표시, 아니면 다음 달의 첫 주를 표시
    if (nextWeekMonth === actualNewMonth && nextWeekYear === newYear) {
      // 끊긴 곳부터 이어지기
      this.currentDate = new Date(nextWeekDate);
      this.targetMonth = actualNewMonth;
      this.targetYear = newYear;
    } else {
      // 다음 달의 첫 주를 표시
      const firstDayOfMonth = new Date(newYear, actualNewMonth, 1);
      const dayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
      const startOfWeek = new Date(firstDayOfMonth);
      startOfWeek.setDate(firstDayOfMonth.getDate() - dayOfWeek); // 일요일로 이동
      
      this.currentDate = new Date(startOfWeek);
      this.targetMonth = actualNewMonth;
      this.targetYear = newYear;
    }
    
    // initializeWeekDays 호출 (targetMonth가 이미 설정되어 있음)
    this.initializeWeekDays();
    
    this.cdr.detectChanges();
  }

  previousDay(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // currentDate는 주의 시작점(일요일)을 가리킴
    // 이전 주의 일요일로 이동 (단순히 7일 전으로) - 모든 주를 순차적으로 표시
    const newDate = new Date(this.currentDate);
    newDate.setDate(newDate.getDate() - 7);
    this.currentDate = new Date(newDate);
    
    // weekDays 업데이트
    this.initializeWeekDays();
    
    // 주에 가장 많은 날짜가 있는 달을 targetMonth로 업데이트
    // 첫 주와 마지막 주가 빠지지 않도록 로직 보장
    this.updateTargetMonthFromWeek();
    
    // targetMonth가 변경되었을 수 있으므로 달 이름 업데이트
    this.currentMonth = new Date(this.targetYear, this.targetMonth, 1).toLocaleString('default', { month: 'long' });
    
    // isCurrentMonth 업데이트 - 모든 날짜는 표시되지만, 현재 달이 아닌 날짜는 빈 칸으로
    this.weekDays.forEach(day => {
      day.isCurrentMonth = day.fullDate.getMonth() === this.targetMonth && day.fullDate.getFullYear() === this.targetYear;
    });
    
    this.cdr.detectChanges();
  }

  nextDay(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // currentDate는 주의 시작점(일요일)을 가리킴
    // 다음 주의 일요일로 이동 (단순히 7일 후로) - 모든 주를 순차적으로 표시
    const newDate = new Date(this.currentDate);
    newDate.setDate(newDate.getDate() + 7);
    this.currentDate = new Date(newDate);
    
    // weekDays 업데이트
    this.initializeWeekDays();
    
    // 주에 가장 많은 날짜가 있는 달을 targetMonth로 업데이트
    // 첫 주와 마지막 주가 빠지지 않도록 로직 보장
    this.updateTargetMonthFromWeek();
    
    // targetMonth가 변경되었을 수 있으므로 달 이름 업데이트
    this.currentMonth = new Date(this.targetYear, this.targetMonth, 1).toLocaleString('default', { month: 'long' });
    
    // isCurrentMonth 업데이트 - 모든 날짜는 표시되지만, 현재 달이 아닌 날짜는 빈 칸으로
    this.weekDays.forEach(day => {
      day.isCurrentMonth = day.fullDate.getMonth() === this.targetMonth && day.fullDate.getFullYear() === this.targetYear;
    });
    
    this.cdr.detectChanges();
  }

  // 주에 가장 많은 날짜가 있는 달을 targetMonth로 업데이트
  updateTargetMonthFromWeek() {
    const monthCounts = new Map<number, { count: number; year: number }>();
    
    // 주의 모든 날짜를 확인하여 각 달의 날짜 개수 계산
    this.weekDays.forEach(day => {
      const month = day.fullDate.getMonth();
      const year = day.fullDate.getFullYear();
      const key = year * 12 + month;
      
      if (!monthCounts.has(key)) {
        monthCounts.set(key, { count: 0, year: year });
      }
      monthCounts.get(key)!.count++;
    });
    
    // 가장 많은 날짜가 있는 달 찾기
    let maxKey = -1;
    let maxCount = 0;
    
    monthCounts.forEach((value, key) => {
      if (value.count > maxCount) {
        maxCount = value.count;
        maxKey = key;
      }
    });
    
    // 가장 많은 날짜가 있는 달을 targetMonth로 설정
    if (maxKey >= 0) {
      const maxValue = monthCounts.get(maxKey)!;
      this.targetYear = maxValue.year;
      this.targetMonth = maxKey % 12;
    }
  }

  filterInventory() {
    this.applyFilters();
  }

  // Helper method to escape special regex characters
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  updatePagination() {
    this.totalPages = Math.ceil(this.filteredInventory.length / this.itemsPerPage);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedInventory = this.filteredInventory.slice(startIndex, endIndex);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

  getPagesArray(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i + 1);
  }

  toggleFilter() {
    this.showFilter = !this.showFilter;
  }

  onCategoryToggle(category: string, checked: boolean) {
    if (checked) {
      this.selectedCategories.add(category);
    } else {
      this.selectedCategories.delete(category);
    }
    console.log('🔍 Selected categories:', Array.from(this.selectedCategories));
    this.applyFilters();
  }

  onCategoryAllToggle(checked: boolean) {
    if (checked) {
      this.availableCategories.forEach(cat => this.selectedCategories.add(cat));
    } else {
      this.selectedCategories.clear();
    }
    this.applyFilters();
  }

  applyExpiryFilter() {
    this.applyFilters();
  }

  resetExpiryFilter() {
    this.expiryFilterDays = null;
    this.applyFilters();
  }

  applyFilters() {
    let filtered = [...this.inventory];

    // Apply category filter (case-insensitive comparison)
    // If no categories are selected, show all items (shouldn't happen after initialization, but safety check)
    if (this.selectedCategories.size > 0) {
      filtered = filtered.filter(item => {
        if (!item.category) return false;
        // Normalize category name for comparison (trim and lowercase)
        const normalizedItemCategory = item.category.trim().toLowerCase();
        // Check if any selected category matches (case-insensitive)
        return Array.from(this.selectedCategories).some(selectedCat => 
          selectedCat.trim().toLowerCase() === normalizedItemCategory
        );
      });
    }
    // If selectedCategories is empty, show all items (all items pass through)

    // Apply expiry filter
    if (this.expiryFilterDays !== null && this.expiryFilterDays > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const filterDays = this.expiryFilterDays; // Store in local variable for type safety
      
      filtered = filtered.filter(item => {
        if (!item.expiry) return false;
        
        // Parse expiry date (DD/MM/YYYY format)
        const expiryParts = item.expiry.split('/');
        if (expiryParts.length !== 3) return false;
        
        const expiryDate = new Date(
          parseInt(expiryParts[2]), 
          parseInt(expiryParts[1]) - 1, 
          parseInt(expiryParts[0])
        );
        expiryDate.setHours(0, 0, 0, 0);
        
        const diffTime = expiryDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Show items that expire within the specified days (including today)
        return diffDays >= 0 && diffDays <= filterDays;
      });
    }

    // Apply search term filter
    if (this.searchTerm.trim()) {
      const searchTermLower = this.searchTerm.toLowerCase().trim();
      const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 0);
      
      filtered = filtered.filter(item => {
        const itemNameLower = item.name.toLowerCase();
        const itemCategoryLower = item.category.toLowerCase();
        
        return searchWords.every(word => {
          const wordPattern = new RegExp(`(^|\\s)${this.escapeRegex(word)}`, 'i');
          const nameMatch = wordPattern.test(itemNameLower) || itemNameLower === word;
          const categoryMatch = wordPattern.test(itemCategoryLower) || itemCategoryLower === word;
          return nameMatch || categoryMatch;
        });
      });
    }

    this.filteredInventory = filtered;
    this.currentPage = 1;
    this.updatePagination();
  }

  resetFilters() {
    this.selectedCategories.clear();
    this.expiryFilterDays = null;
    this.searchTerm = '';
    this.applyFilters();
  }

  // Update available categories from actual inventory data
  updateAvailableCategories() {
    const categorySet = new Set<string>();
    this.inventory.forEach(item => {
      if (item.category && item.category.trim()) {
        // Preserve original case for display, but normalize for comparison
        categorySet.add(item.category.trim());
      }
    });
    // Sort categories alphabetically (case-insensitive) for consistent display
    this.availableCategories = Array.from(categorySet).sort((a, b) => 
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
    
    console.log('📋 Available categories from inventory:', this.availableCategories);
    console.log('📋 Inventory items:', this.inventory.map(item => ({ name: item.name, category: item.category })));
    
    // If no categories found, use default list
    if (this.availableCategories.length === 0) {
      this.availableCategories = ['Fruit', 'Vegetable', 'Meat', 'Dairy', 'Grains', 'Other'];
    }
    
    // Initialize: Select all categories by default if none are selected
    // This ensures all items are visible when filter is first opened
    if (this.selectedCategories.size === 0 && this.availableCategories.length > 0) {
      this.availableCategories.forEach(cat => this.selectedCategories.add(cat));
      console.log('✅ Initialized: All categories selected by default');
    }
  }

  selectItem(index: number) {
    this.selectedItemIndex = index;
  }

  getCategoryIcon(category: string): string {
    const icons: { [key: string]: string } = {
      'Fruit': '🍎',
      'Vegetable': '🥬',
      'Meat': '🥩',
      'Dairy': '🥛',
      'Grains': '🌾',
      'Other': '📦'
    };
    return icons[category] || '📦';
  }

  // 날짜 키 생성 (YYYY-MM-DD)
  getDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Meal slot 클릭 핸들러
  selectMealSlot(day: DayInfo, mealType: string) {
    this.selectedDay = day;
    this.selectedMealType = mealType;
    
    const dateKey = this.getDateKey(day.fullDate);
    const mealKey = `${dateKey}-${mealType}`;
    
    // 해당 meal에 계획이 있는지 확인
    const hasMeal = this.mealPlans.has(mealKey);
    
    if (!hasMeal) {
      // meal이 없으면 옵션 표시
      this.showMealOptions = true;
    } else {
      // meal이 있으면 편집 가능하도록 (추후 구현)
      this.showMealOptions = false;
    }
    
    this.cdr.detectChanges();
  }

  // Meal 옵션 닫기
  closeMealOptions() {
    this.showMealOptions = false;
    this.selectedDay = null;
    this.selectedMealType = null;
    this.cdr.detectChanges();
  }

  // Add your own meal 버튼 클릭
  addOwnMeal(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // 과거 날짜인 경우 동작하지 않음
    if (this.isPastDateSelected()) {
      return;
    }
    
    console.log('addOwnMeal called', { selectedDay: this.selectedDay, selectedMealType: this.selectedMealType });
    
    if (this.selectedDay && this.selectedMealType) {
      const dateKey = this.getDateKey(this.selectedDay.fullDate);
      console.log('Navigating to add-custom-meal with:', { date: dateKey, mealType: this.selectedMealType });
      // Add Custom meals 페이지로 이동하며 날짜와 meal type 전달
      this.router.navigate(['/add-custom-meal'], {
        queryParams: {
          date: dateKey,
          mealType: this.selectedMealType
        }
      });
    } else {
      console.warn('Cannot navigate: selectedDay or selectedMealType is missing');
      alert('Please select a meal slot first');
    }
  }

  // Browse recipes 버튼 클릭
  browseRecipes(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // 과거 날짜인 경우 동작하지 않음
    if (this.isPastDateSelected()) {
      return;
    }
    
    if (this.selectedDay && this.selectedMealType) {
      const dateKey = this.getDateKey(this.selectedDay.fullDate);
      // Browse Recipes 페이지로 이동하며 날짜와 meal type 전달
      this.router.navigate(['/browse-recipes'], {
        queryParams: {
          date: dateKey,
          mealType: this.selectedMealType
        }
      });
    } else {
      console.warn('Cannot navigate: selectedDay or selectedMealType is missing');
      alert('Please select a meal slot first');
    }
  }

  // 특정 날짜와 meal 타입에 meal이 있는지 확인
  hasMeal(day: DayInfo, mealType: string): boolean {
    const dateKey = this.getDateKey(day.fullDate);
    const mealKey = `${dateKey}-${mealType}`;
    return this.mealPlans.has(mealKey);
  }

  // 특정 날짜와 meal 타입의 meal 이름 가져오기
  getMealName(day: DayInfo, mealType: string): string {
    const dateKey = this.getDateKey(day.fullDate);
    const mealKey = `${dateKey}-${mealType}`;
    const meal = this.mealPlans.get(mealKey);
    return meal ? meal.mealName : '';
  }

  // 선택된 날짜가 과거 날짜인지 확인
  isPastDateSelected(): boolean {
    if (!this.selectedDay) {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(this.selectedDay.fullDate);
    selectedDate.setHours(0, 0, 0, 0);
    return selectedDate.getTime() < today.getTime();
  }
}

