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
  markedFoodIds?: string[]; // Array of MarkedFood _id values for this foodId
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

  // Remove modal
  showRemoveModal: boolean = false;
  removeItem: InventoryItem | null = null;
  removeQuantity: number = 1;
  isRemoving: boolean = false; // Loading state
  rawMarkedFoods: MarkedFood[] = []; // Cache for faster access
  
  // Success message
  showSuccessMessage: boolean = false;
  successMessage: string = '';

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
        // Store raw marked foods for faster access (avoid re-fetching)
        this.rawMarkedFoods = markedFoods;
        // Reduced logging for performance - uncomment for debugging
        // console.log('📌 Loaded marked foods:', markedFoods);
        
        // Convert marked foods to InventoryItem format
        // Use exact quantities from database
        const markedItems = markedFoods.map((markedFood: MarkedFood) => {
          let expiryStr = '';
          if (markedFood.expiry) {
            const expiryDate = new Date(markedFood.expiry);
            const day = String(expiryDate.getDate()).padStart(2, '0');
            const month = String(expiryDate.getMonth() + 1).padStart(2, '0');
            const year = expiryDate.getFullYear();
            expiryStr = `${day}/${month}/${year}`;
          }

          // Handle foodId - it might be an object if populated, or a string
          let foodIdStr = '';
          const foodIdValue = (markedFood as any).foodId; // Use any to handle populated object
          
          if (typeof foodIdValue === 'string') {
            foodIdStr = foodIdValue;
          } else if (foodIdValue && typeof foodIdValue === 'object' && foodIdValue._id) {
            // If populated, extract the _id
            foodIdStr = foodIdValue._id;
          } else if (foodIdValue) {
            // Fallback: try to convert to string
            foodIdStr = String(foodIdValue);
          }

          // Use exact qty from database
          const dbQty = markedFood.qty || 0;
          
          // Reduced logging for performance
          // console.log('🔍 Processing markedFood from DB:', {
          //   _id: markedFood._id,
          //   name: markedFood.name,
          //   qty: dbQty,
          //   foodId: foodIdStr
          // });

          return {
            foodId: foodIdStr,
            name: markedFood.name,
            quantity: dbQty, // Exact quantity from database
            category: markedFood.category || 'Other',
            marked: true,
            markedQuantity: dbQty, // Exact marked quantity from database
            expiry: expiryStr,
            markedFoodIds: markedFood._id ? [markedFood._id] : []
          };
        });

        // Merge marked items with same foodId (same food item marked multiple times)
        // Sum up quantities from database accurately
        const markedItemsByFoodId = new Map<string, InventoryItem>();
        markedItems.forEach(item => {
          const foodId = item.foodId;
          if (!foodId) {
            // If no foodId, skip or handle separately
            return;
          }
          
          const existing = markedItemsByFoodId.get(foodId);
          if (existing) {
            // If same foodId exists, sum quantities from database (same food item marked multiple times)
            // Both quantity and markedQuantity should be the sum of all marked quantities from DB
            const newQuantity = existing.quantity + item.quantity;
            const newMarkedQuantity = existing.markedQuantity + item.markedQuantity;
            
            // Reduced logging for performance
            // console.log(`🔍 Merging ${item.name}:`, {
            //   existingQty: existing.quantity,
            //   newItemQty: item.quantity,
            //   totalQty: newQuantity,
            //   existingMarkedQty: existing.markedQuantity,
            //   newItemMarkedQty: item.markedQuantity,
            //   totalMarkedQty: newMarkedQuantity
            // });
            
            existing.quantity = newQuantity;
            existing.markedQuantity = newMarkedQuantity;
            // Merge markedFoodIds arrays
            if (item.markedFoodIds && item.markedFoodIds.length > 0) {
              existing.markedFoodIds = (existing.markedFoodIds || []).concat(item.markedFoodIds);
            }
          } else {
            // Add new item with exact database quantities
            markedItemsByFoodId.set(foodId, { ...item });
          }
        });

        this.inventory = Array.from(markedItemsByFoodId.values());
        // Reduced logging for performance - uncomment for debugging
        // console.log('📌 Final inventory from database:', this.inventory.map(item => ({
        //   name: item.name,
        //   quantity: item.quantity,
        //   markedQuantity: item.markedQuantity,
        //   foodId: item.foodId
        // })));
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

  openRemoveModal(item: InventoryItem, event: Event) {
    event.stopPropagation(); // Prevent row click
    console.log('🔍 Opening remove modal for item:', item);
    console.log('🔍 Item foodId:', item.foodId);
    
    if (!item || !item.foodId) {
      console.error('❌ Invalid item or missing foodId:', item);
      alert('Invalid item selected');
      return;
    }
    
    this.removeItem = item;
    this.removeQuantity = 1;
    this.showRemoveModal = true;
  }

  closeRemoveModal() {
    this.showRemoveModal = false;
    this.removeItem = null;
    this.removeQuantity = 1;
  }

  showSuccessToast(message: string) {
    this.successMessage = message;
    this.showSuccessMessage = true;
    // Auto-close after 3 seconds
    setTimeout(() => {
      this.showSuccessMessage = false;
      this.successMessage = '';
    }, 3000);
  }

  confirmRemove() {
    if (!this.removeItem || !this.removeItem.foodId) {
      alert('Invalid item selected');
      return;
    }

    if (this.removeQuantity <= 0 || this.removeQuantity > this.removeItem.markedQuantity) {
      alert(`Please enter a valid quantity (1-${this.removeItem.markedQuantity})`);
      return;
    }

    this.isRemoving = true; // Show loading state
    const item = this.removeItem;
    const removeQty = this.removeQuantity;
    const remainingMarkedQty = item.markedQuantity - removeQty;

    // First, get the original food item to restore quantity
    // Use getFoods and filter by foodId instead of getFoodById for better compatibility
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user.id;

    if (!userId) {
      alert('User ID not found');
      return;
    }

    this.foodService.getFoods(userId).subscribe({
      next: (foods: any[]) => {
        console.log('🔍 Searching for food with foodId:', item.foodId);
        console.log('🔍 Available foods:', foods.map(f => ({ _id: f._id, name: f.name })));
        
        // Try to find by _id (string comparison)
        let originalFood = foods.find(f => f._id === item.foodId);
        
        // If not found, try converting both to strings
        if (!originalFood) {
          originalFood = foods.find(f => String(f._id) === String(item.foodId));
        }
        
        // If still not found, try finding by name as fallback (less reliable)
        if (!originalFood) {
          console.warn('⚠️ Food not found by ID, trying to find by name:', item.name);
          originalFood = foods.find(f => f.name === item.name && f.status === 'inventory');
        }
        
        if (!originalFood) {
          console.error('❌ Original food item not found. foodId:', item.foodId, 'name:', item.name);
          alert(`Original food item "${item.name}" not found in inventory. It may have been deleted.`);
          this.closeRemoveModal();
          return;
        }
        
        console.log('✅ Found original food:', originalFood);
        console.log(`🔍 Remove calculation:`, {
          originalQty: originalFood.qty,
          removeQty: removeQty,
          newQty: originalFood.qty + removeQty
        });

        const actualFoodId = originalFood._id || item.foodId; // Use the actual _id from found food
        const originalQtyBeforeUpdate = originalFood.qty; // Store original qty for rollback
        const newInventoryQty = originalQtyBeforeUpdate + removeQty;

        // CRITICAL: Update original food quantity ONCE before processing marked foods
        // This ensures we only add the total removeQty once, not per marked food
        console.log(`🟢 [Frontend] Updating food ${actualFoodId} qty from ${originalQtyBeforeUpdate} to ${newInventoryQty}`);
        this.browseService.updateFoodQty(actualFoodId, newInventoryQty).subscribe({
          next: (updatedFood) => {
            console.log(`✅ [DB] Food updated in database: ${item.name}, qty: ${originalQtyBeforeUpdate} → ${newInventoryQty}`);
            console.log(`✅ Restored ${removeQty} ${item.name}(s) to inventory`);

            // Now update or delete marked food(s)
            if (remainingMarkedQty <= 0) {
              // Remove all marked foods for this foodId
              if (item.markedFoodIds && item.markedFoodIds.length > 0) {
                // Delete all marked foods
                const deletePromises = item.markedFoodIds.map(id => 
                  this.browseService.deleteMarkedFood(id).toPromise()
                );
                Promise.all(deletePromises).then(() => {
                  console.log('✅ All marked foods removed');
                  this.isRemoving = false;
                  // Update local state immediately (no need to reload from DB)
                  this.updateLocalInventoryAfterRemove(item, removeQty, []);
                  // Close modal and show success message
                  this.closeRemoveModal();
                  this.showSuccessToast(`Removed ${removeQty} ${item.name}(s) successfully✅`);
                }).catch(err => {
                  console.error('❌ Error deleting marked foods:', err);
                  this.isRemoving = false;
                  // Reload on error to show actual state
                  this.loadInventory();
                  alert('Failed to remove marked foods❌');
                });
              } else {
                // If no markedFoodIds, reload to get them
                this.isRemoving = false;
                this.loadInventory();
                this.closeRemoveModal();
              }
            } else {
              // Update marked food quantity
              // Use cached rawMarkedFoods instead of fetching again
              if (item.markedFoodIds && item.markedFoodIds.length > 0) {
                // Extract foodId from markedFood (handle populated objects)
                const extractFoodId = (mf: MarkedFood): string => {
                  const foodIdValue = (mf as any).foodId;
                  if (typeof foodIdValue === 'string') {
                    return foodIdValue;
                  } else if (foodIdValue && typeof foodIdValue === 'object' && foodIdValue._id) {
                    return foodIdValue._id;
                  }
                  return String(foodIdValue || '');
                };

                // Filter marked foods by foodId using cached data
                const relevantMarkedFoods = this.rawMarkedFoods.filter(mf => {
                  const mfFoodId = extractFoodId(mf);
                  return String(mfFoodId) === String(item.foodId) && 
                         item.markedFoodIds?.includes(mf._id || '');
                });

                    console.log('🔍 Relevant marked foods:', relevantMarkedFoods);
                    console.log('🔍 Total to remove:', removeQty);

                    if (relevantMarkedFoods.length === 0) {
                      console.warn('⚠️ No relevant marked foods found, reloading...');
                      this.isRemoving = false;
                      this.loadInventory();
                      this.closeRemoveModal();
                      return;
                    }

                    // Remove quantity sequentially from marked foods (FIFO - first in first out)
                    let remainingToRemove = removeQty;
                    let completedOperations = 0;
                    let hasError = false;
                    const totalMarkedFoods = relevantMarkedFoods.length;
                    let operationsStarted = 0;

                    const finishProcessing = () => {
                      this.isRemoving = false;
                      if (hasError) {
                        // Rollback: restore original food quantity
                        console.log('🔄 Rolling back due to errors...');
                        this.browseService.updateFoodQty(actualFoodId, originalQtyBeforeUpdate).subscribe({
                          next: () => {
                            console.log('✅ Rollback successful');
                            this.loadInventory();
                            this.closeRemoveModal();
                            alert('Failed to remove marked foods. Changes have been rolled back.❌');
                          },
                          error: (rollbackErr) => {
                            console.error('❌ Rollback failed:', rollbackErr);
                            this.loadInventory();
                            this.closeRemoveModal();
                            alert('Failed to remove marked foods. Please check the inventory.❌');
                          }
                        });
                        return;
                      }
                      
                      console.log('✅ All marked foods processed successfully');
                      // Update local state immediately (no need to reload from DB)
                      this.updateLocalInventoryAfterRemove(item, removeQty, relevantMarkedFoods);
                      // Close modal and show success message
                      this.closeRemoveModal();
                      this.showSuccessToast(`Removed ${removeQty} ${item.name}(s) successfully✅`);
                    };

                    const checkCompletion = () => {
                      // Check if all operations are complete
                      console.log(`🔍 Completion check: completed=${completedOperations}, started=${operationsStarted}, remaining=${remainingToRemove}`);
                      if (completedOperations === operationsStarted && operationsStarted > 0) {
                        console.log('✅ All operations completed, finishing...');
                        finishProcessing();
                      } else if (remainingToRemove <= 0 && operationsStarted === 0) {
                        // No operations needed (nothing to remove)
                        console.log('✅ No operations needed, finishing...');
                        finishProcessing();
                      }
                    };

                    const processNextMarkedFood = (index: number) => {
                      // If no more to remove, finish
                      if (remainingToRemove <= 0) {
                        console.log('✅ All quantity removed');
                        checkCompletion();
                        return;
                      }
                      
                      // If we've processed all marked foods, finish
                      if (index >= totalMarkedFoods) {
                        console.log('✅ All marked foods processed');
                        checkCompletion();
                        return;
                      }

                      const markedFood = relevantMarkedFoods[index];
                      if (!markedFood._id) {
                        // Skip invalid marked food and continue
                        processNextMarkedFood(index + 1);
                        return;
                      }

                      const thisMarkedQty = markedFood.qty;
                      const qtyToRemoveFromThis = Math.min(remainingToRemove, thisMarkedQty);
                      const newQty = thisMarkedQty - qtyToRemoveFromThis;
                      
                      operationsStarted++;

                      console.log(`🔍 Processing marked food ${index + 1}/${totalMarkedFoods}:`, {
                        _id: markedFood._id,
                        currentQty: thisMarkedQty,
                        removeQty: qtyToRemoveFromThis,
                        newQty: newQty,
                        remainingToRemove: remainingToRemove
                      });

                      // Update remainingToRemove AFTER starting the operation
                      remainingToRemove -= qtyToRemoveFromThis;

                      if (newQty <= 0) {
                        // Delete this marked food from database
                        this.browseService.deleteMarkedFood(markedFood._id).subscribe({
                          next: () => {
                            console.log(`✅ [DB] Marked food deleted: ${markedFood._id}`);
                            completedOperations++;
                            // Continue with next marked food
                            processNextMarkedFood(index + 1);
                            checkCompletion();
                          },
                          error: (err) => {
                            console.error('❌ Error deleting marked food:', err);
                            hasError = true;
                            completedOperations++;
                            // Continue processing even on error
                            processNextMarkedFood(index + 1);
                            checkCompletion();
                          }
                        });
                      } else {
                        // Update this marked food in database
                        this.browseService.updateMarkedFoodQty(markedFood._id, newQty).subscribe({
                          next: (updatedMarkedFood) => {
                            console.log(`✅ [DB] Marked food updated: ${markedFood._id}, qty: ${newQty}`);
                            completedOperations++;
                            // Continue with next marked food
                            processNextMarkedFood(index + 1);
                            checkCompletion();
                          },
                          error: (err) => {
                            console.error('❌ Error updating marked food:', err);
                            hasError = true;
                            completedOperations++;
                            // Continue processing even on error
                            processNextMarkedFood(index + 1);
                            checkCompletion();
                          }
                        });
                      }
                    };

                    // Start processing from the first marked food
                    processNextMarkedFood(0);
              } else {
                this.isRemoving = false;
                this.loadInventory();
                this.closeRemoveModal();
              }
            }
          },
          error: (err) => {
            console.error('❌ Error updating inventory quantity:', err);
            this.isRemoving = false;
            alert('Failed to restore inventory quantity❌');
          }
        });
      },
      error: (err) => {
        console.error('❌ Error fetching original food:', err);
        this.isRemoving = false;
        alert('Failed to fetch original food item❌');
      }
    });
  }

  // Optimize: Update local inventory state immediately for better UX
  updateLocalInventoryAfterRemove(item: InventoryItem, removeQty: number, processedMarkedFoods: MarkedFood[]) {
    // Update local inventory item
    const inventoryItem = this.inventory.find(inv => inv.foodId === item.foodId);
    if (inventoryItem) {
      // Only update markedQuantity, NOT quantity (quantity is the original food quantity from DB)
      inventoryItem.markedQuantity -= removeQty;
      
      // If marked quantity becomes 0, remove from inventory
      if (inventoryItem.markedQuantity <= 0) {
        const index = this.inventory.indexOf(inventoryItem);
        if (index > -1) {
          this.inventory.splice(index, 1);
        }
      }
      
      // Also update rawMarkedFoods cache to keep it in sync
      if (processedMarkedFoods && processedMarkedFoods.length > 0) {
        processedMarkedFoods.forEach(mf => {
          const cached = this.rawMarkedFoods.find(r => r._id === mf._id);
          if (cached) {
            const newQty = mf.qty - removeQty;
            if (newQty <= 0) {
              const cachedIndex = this.rawMarkedFoods.indexOf(cached);
              if (cachedIndex > -1) {
                this.rawMarkedFoods.splice(cachedIndex, 1);
              }
            } else {
              cached.qty = newQty;
            }
          }
        });
      }
    }
    
    // Update filtered inventory and pagination
    this.applyFilters();
    this.cdr.detectChanges();
  }

  getCategoryIcon(category: string): string {
    if (!category) return '📦';
    
    // Normalize category name (lowercase, handle singular/plural)
    const normalized = category.trim().toLowerCase();
    const singular = normalized.endsWith('s') ? normalized.slice(0, -1) : normalized;
    
    // Map to icons (case-insensitive, handles singular/plural)
    if (singular.includes('fruit')) return '🍎';
    if (singular.includes('vegetable')) return '🥬';
    if (singular.includes('meat')) return '🥩';
    if (singular.includes('dairy')) return '🥛';
    if (singular.includes('grain') || singular.includes('carb')) return '🌾';
    if (singular.includes('other')) return '📦';
    
    // Fallback to default
    return '📦';
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

