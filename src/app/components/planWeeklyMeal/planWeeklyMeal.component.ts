import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { FoodService } from '../../services/food.service';
import { BrowseFoodService, MarkedFood, Food } from '../../services/browse-food.service';
import { CustomMealService, CustomMeal } from '../../services/custom-meal.service';

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
  customMealsCache: CustomMeal[] = []; // Custom meals 캐시
  selectedDay: DayInfo | null = null;
  selectedMealType: string | null = null;
  showMealOptions: boolean = false;
  selectedCustomMeal: CustomMeal | null = null; // 현재 선택된 custom meal
  showCustomMealDetails: boolean = false; // Custom meal 상세 정보 표시 여부
  
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

  // Inventory type selection
  inventoryType: 'marked' | 'non-marked' = 'marked';

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
    private browseService: BrowseFoodService,
    private customMealService: CustomMealService
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
    this.loadCustomMeals();
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

    if (this.inventoryType === 'marked') {
      // Load marked foods
      this.loadMarkedFoods();
    } else {
      // Load non-marked foods
      this.loadNonMarkedFoods();
    }
  }

  loadMarkedFoods() {
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

  loadNonMarkedFoods() {
    // Load Current Inventory data directly
    this.browseService.getFoods().subscribe({
      next: (allFoods: Food[]) => {
        console.log('📌 Loaded Current Inventory foods:', allFoods);

        // Convert to InventoryItem format
        const inventoryItems = allFoods.map((food: Food) => {
            let expiryStr = '';
            if (food.expiry) {
              const expiryDate = new Date(food.expiry);
              const day = String(expiryDate.getDate()).padStart(2, '0');
              const month = String(expiryDate.getMonth() + 1).padStart(2, '0');
              const year = expiryDate.getFullYear();
              expiryStr = `${day}/${month}/${year}`;
            }

            return {
            foodId: food._id || '',
              name: food.name,
              quantity: food.qty || 0,
              category: food.category || 'Other',
            marked: false,
            markedQuantity: 0,
              expiry: expiryStr
            };
          });
        
        this.inventory = inventoryItems;
        console.log('📦 Current Inventory loaded:', this.inventory.length, 'items');

        this.updateAvailableCategories();
        this.applyFilters();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading Current Inventory:', err);
        this.inventory = [];
        this.filteredInventory = [];
        this.availableCategories = [];
        this.applyFilters();
        this.cdr.detectChanges();
      }
    });
  }

  onInventoryTypeChange() {
    // Reset filters and reload inventory
    this.searchTerm = '';
    this.selectedCategories.clear();
    this.expiryFilterDays = null;
    this.currentPage = 1;
    this.loadInventory();
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
    
    // Custom meals 다시 로드 (주가 변경되었으므로)
    this.loadCustomMeals();
    
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
    
    // Custom meals 다시 로드 (주가 변경되었으므로)
    this.loadCustomMeals();
    
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

    // Apply search term filter - Only search by name, not category
    if (this.searchTerm.trim()) {
      const searchTermLower = this.searchTerm.toLowerCase().trim();
      const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 0);
      
      filtered = filtered.filter(item => {
        const itemNameLower = item.name.toLowerCase();
        
        return searchWords.every(word => {
          const wordPattern = new RegExp(`(^|\\s)${this.escapeRegex(word)}`, 'i');
          const nameMatch = wordPattern.test(itemNameLower) || itemNameLower === word;
          return nameMatch;
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
                  // Close modal first for better UX
                  this.closeRemoveModal();
                  // Update local state and reload from DB to ensure accuracy
                  this.updateLocalInventoryAfterRemove(item, removeQty, []);
                  // Show success message
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
                      // Close modal first for better UX
                      this.closeRemoveModal();
                      // Update local state and reload from DB to ensure accuracy
                      this.updateLocalInventoryAfterRemove(item, removeQty, relevantMarkedFoods);
                      // Show success message
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
    console.log('🔄 Updating local inventory after remove:', {
      itemName: item.name,
      removeQty: removeQty,
      processedMarkedFoods: processedMarkedFoods.length
    });
    
    // Update rawMarkedFoods cache first - remove or update processed marked foods
    if (processedMarkedFoods && processedMarkedFoods.length > 0) {
      processedMarkedFoods.forEach(mf => {
        const cachedIndex = this.rawMarkedFoods.findIndex(r => r._id === mf._id);
        if (cachedIndex > -1) {
          const cached = this.rawMarkedFoods[cachedIndex];
          // Calculate actual new quantity based on what was removed
          // We need to track what was actually removed from each marked food
          // For now, reload from DB to ensure accuracy
          this.rawMarkedFoods.splice(cachedIndex, 1);
        }
      });
    }
    
    // Reload inventory from database to ensure accuracy
    // This is necessary because the actual quantities updated in DB may differ
    // from what we calculated locally
    setTimeout(() => {
      this.loadInventory();
    }, 200); // Small delay to ensure DB updates are complete
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

  // Custom meals 로드
  loadCustomMeals() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      console.warn('⚠️ localStorage not available (SSR mode). Skipping custom meals load.');
      return;
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user.id;

    if (!userId) {
      console.error('User ID not found in localStorage.');
      return;
    }

    this.customMealService.getCustomMeals(userId).subscribe({
      next: (customMeals: CustomMeal[]) => {
        console.log('📅 Custom meals loaded:', customMeals.length);
        
        // Custom meals 캐시 업데이트
        this.customMealsCache = customMeals;
        
        // Custom meals를 mealPlans Map에 추가
        customMeals.forEach((meal: CustomMeal) => {
          if (meal.date && meal.mealType) {
            const mealKey = `${meal.date}-${meal.mealType}`;
            const mealPlan: MealPlan = {
              dateKey: meal.date,
              mealType: meal.mealType,
              mealName: meal.foodName
            };
            this.mealPlans.set(mealKey, mealPlan);
            console.log(`✅ Added custom meal: ${mealKey} - ${meal.foodName}`);
          }
        });
        
        // UI 업데이트
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading custom meals:', err);
      }
    });
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
      this.showCustomMealDetails = false;
      this.selectedCustomMeal = null;
    } else {
      // meal이 있으면 custom meal 정보 표시 (캐시에서 즉시 로드)
      this.showMealOptions = false;
      this.loadCustomMealDetailsFromCache(dateKey, mealType);
    }
    
    this.cdr.detectChanges();
  }

  // Custom meal 상세 정보를 캐시에서 즉시 로드
  loadCustomMealDetailsFromCache(dateKey: string, mealType: string) {
    // 캐시에서 해당 날짜와 시간대에 맞는 custom meal 찾기
    const customMeal = this.customMealsCache.find(
      (meal: CustomMeal) => meal.date === dateKey && meal.mealType === mealType
    );

    if (customMeal) {
      this.selectedCustomMeal = customMeal;
      this.showCustomMealDetails = true;
      console.log('✅ Custom meal loaded from cache:', customMeal);
      this.cdr.detectChanges();
    } else {
      // 캐시에 없으면 API 호출 (fallback)
      console.warn('⚠️ Custom meal not found in cache, loading from API...');
      this.loadCustomMealDetailsFromAPI(dateKey, mealType);
    }
  }

  // Custom meal 상세 정보를 API에서 로드 (fallback)
  loadCustomMealDetailsFromAPI(dateKey: string, mealType: string) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user.id;

    if (!userId) {
      console.error('User ID not found in localStorage.');
      return;
    }

    this.customMealService.getCustomMeals(userId).subscribe({
      next: (customMeals: CustomMeal[]) => {
        // 캐시 업데이트
        this.customMealsCache = customMeals;
        
        // 해당 날짜와 시간대에 맞는 custom meal 찾기
        const customMeal = customMeals.find(
          (meal: CustomMeal) => meal.date === dateKey && meal.mealType === mealType
        );

        if (customMeal) {
          this.selectedCustomMeal = customMeal;
          this.showCustomMealDetails = true;
          console.log('✅ Custom meal loaded from API:', customMeal);
        } else {
          this.selectedCustomMeal = null;
          this.showCustomMealDetails = false;
          console.warn('⚠️ Custom meal not found for:', dateKey, mealType);
        }
        
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading custom meal details:', err);
        this.selectedCustomMeal = null;
        this.showCustomMealDetails = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Meal 옵션 닫기
  closeMealOptions() {
    this.showMealOptions = false;
    this.showCustomMealDetails = false;
    this.selectedCustomMeal = null;
    this.selectedDay = null;
    this.selectedMealType = null;
    this.cdr.detectChanges();
  }

  // Custom meal 상세 정보 닫기
  closeCustomMealDetails() {
    this.showCustomMealDetails = false;
    this.selectedCustomMeal = null;
    this.selectedDay = null;
    this.selectedMealType = null;
    this.cdr.detectChanges();
  }

  // Ingredients를 파싱하여 배열로 반환 (예: "Tomato Sauce 150g\nSpaghetti 100g" -> [{name: "Tomato Sauce", qty: "150g"}, ...])
  parseIngredients(ingredients: string): Array<{name: string, qty: string}> {
    if (!ingredients || !ingredients.trim()) {
      return [];
    }
    
    const lines = ingredients.split('\n').filter(line => line.trim());
    return lines.map(line => {
      // "재료명 수량" 형식으로 파싱
      const parts = line.trim().split(/\s+(?=\d|tbsp|tsp|g|kg|ml|l|cup|cups)/);
      if (parts.length >= 2) {
        return {
          name: parts.slice(0, -1).join(' '),
          qty: parts[parts.length - 1]
        };
      }
      return { name: line.trim(), qty: '' };
    });
  }

  // Custom meal 삭제
  deleteCustomMeal() {
    if (!this.selectedCustomMeal || !this.selectedCustomMeal._id) {
      alert('No meal selected to delete');
      return;
    }

    if (!confirm(`Are you sure you want to delete "${this.selectedCustomMeal.foodName}"?`)) {
      return;
    }

    console.log('🗑️ Deleting custom meal:', this.selectedCustomMeal);
    console.log('🗑️ Meal ingredients:', this.selectedCustomMeal?.ingredients);
    
    this.customMealService.deleteCustomMeal(this.selectedCustomMeal._id).subscribe({
      next: () => {
        console.log('✅ Custom meal deleted successfully from database');
        
        // Restore ingredient quantities to marked/non-marked foods
        if (!this.selectedCustomMeal || !this.selectedCustomMeal.ingredients) {
          console.warn('⚠️ No ingredients to restore');
          // If no ingredients, just proceed with deletion
          if (this.selectedDay && this.selectedMealType) {
            const dateKey = this.getDateKey(this.selectedDay.fullDate);
            const mealKey = `${dateKey}-${this.selectedMealType}`;
            this.mealPlans.delete(mealKey);
          }
          if (this.selectedCustomMeal && this.selectedCustomMeal._id) {
            this.customMealsCache = this.customMealsCache.filter(
              meal => meal._id !== this.selectedCustomMeal!._id
            );
          }
          this.closeCustomMealDetails();
          
          // Reload inventory
          this.loadInventory();
          
          // Reload custom meals to update the meal plans display
          this.loadCustomMeals();
          
          this.cdr.detectChanges();
          alert('Meal deleted successfully!');
          return;
        }
        
        this.restoreIngredientQuantities(this.selectedCustomMeal.ingredients).then(() => {
          // mealPlans에서 제거
          if (this.selectedDay && this.selectedMealType) {
            const dateKey = this.getDateKey(this.selectedDay.fullDate);
            const mealKey = `${dateKey}-${this.selectedMealType}`;
            this.mealPlans.delete(mealKey);
          }
          
          // 캐시에서도 제거
          if (this.selectedCustomMeal && this.selectedCustomMeal._id) {
            this.customMealsCache = this.customMealsCache.filter(
              meal => meal._id !== this.selectedCustomMeal!._id
            );
          }
          
          // UI 업데이트
          this.closeCustomMealDetails();
          
          // Reload inventory to reflect restored quantities
          this.loadInventory();
          
          // Reload custom meals to update the meal plans display
          this.loadCustomMeals();
          
          this.cdr.detectChanges();
          
          alert('Meal deleted successfully!');
        }).catch((err: any) => {
          console.error('❌ Error restoring ingredient quantities:', err);
          // Still proceed with deletion even if restoration fails
          if (this.selectedDay && this.selectedMealType) {
            const dateKey = this.getDateKey(this.selectedDay.fullDate);
            const mealKey = `${dateKey}-${this.selectedMealType}`;
            this.mealPlans.delete(mealKey);
          }
          if (this.selectedCustomMeal && this.selectedCustomMeal._id) {
            this.customMealsCache = this.customMealsCache.filter(
              meal => meal._id !== this.selectedCustomMeal!._id
            );
          }
            this.closeCustomMealDetails();
            
            // Reload inventory even if restoration failed
            this.loadInventory();
            
            this.cdr.detectChanges();
            alert('Meal deleted but failed to restore ingredient quantities. Please check your inventory.');
        });
      },
      error: (err: any) => {
        console.error('❌ Error deleting custom meal:', err);
        console.error('❌ Error details:', JSON.stringify(err, null, 2));
        alert(`Failed to delete meal: ${err.error?.message || err.message || 'Unknown error'}. Please try again.`);
      }
    });
  }

  // Custom meal 편집 (add-custom-meal 페이지로 이동)
  editCustomMeal() {
    if (!this.selectedCustomMeal || !this.selectedDay || !this.selectedMealType) {
      alert('No meal selected to edit');
      return;
    }

    const dateKey = this.getDateKey(this.selectedDay.fullDate);
    this.router.navigate(['/add-custom-meal'], {
      queryParams: {
        date: dateKey,
        mealType: this.selectedMealType,
        edit: 'true',
        id: this.selectedCustomMeal._id
      }
    });
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

  // 선택된 custom meal의 날짜가 지난 날짜인지 확인
  isSelectedMealPastDate(): boolean {
    if (!this.selectedCustomMeal || !this.selectedCustomMeal.date) {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // date는 YYYY-MM-DD 형식
    const mealDate = new Date(this.selectedCustomMeal.date);
    mealDate.setHours(0, 0, 0, 0);
    
    return mealDate.getTime() < today.getTime();
  }

  // Parse ingredients string and restore quantities to marked/non-marked foods
  // Format: "IngredientName Quantity [marked|non-marked]"
  async restoreIngredientQuantities(ingredientsStr: string): Promise<void> {
    console.log('🔄 Starting restoreIngredientQuantities with:', ingredientsStr);
    
    if (!ingredientsStr || !ingredientsStr.trim()) {
      console.warn('⚠️ No ingredients string provided');
      return;
    }

    const userId = JSON.parse(localStorage.getItem('user') || '{}').id;
    if (!userId) {
      throw new Error('User ID not found');
    }

    // Parse ingredients
    const lines = ingredientsStr.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    console.log('📝 Parsed lines:', lines);
    const ingredients: Array<{ name: string; quantity: number; inventoryType: 'marked' | 'non-marked' }> = [];

    for (const line of lines) {
      console.log('🔍 Processing line:', line);
      
      // Extract inventory type: [marked] or [non-marked]
      const typeMatch = line.match(/\s+\[(marked|non-marked)\]\s*$/);
      const inventoryType = typeMatch ? (typeMatch[1] as 'marked' | 'non-marked') : 'marked';
      const lineWithoutType = typeMatch ? line.substring(0, typeMatch.index).trim() : line;
      console.log('📦 Inventory type:', inventoryType, 'Line without type:', lineWithoutType);

      // Extract quantity - try multiple patterns
      let quantity = 0;
      let name = '';
      
      // Pattern 1: "Name 200g [marked]" or "Name 200 [marked]"
      const quantityMatch = lineWithoutType.match(/\s+(\d+(?:\.\d+)?)\s*(g|kg|ml|l|tbsp|tsp|cup|cups|oz|lb|개|조각|컵|스푼|작은술|큰술)?\s*$/i);
      if (quantityMatch) {
        quantity = parseFloat(quantityMatch[1]);
        name = lineWithoutType.substring(0, quantityMatch.index).trim();
        console.log('✅ Pattern 1 matched - Name:', name, 'Quantity:', quantity);
      } else {
        // Pattern 2: "Name 200 [marked]" (just number)
        const numberMatch = lineWithoutType.match(/\s+(\d+(?:\.\d+)?)\s*$/);
        if (numberMatch) {
          quantity = parseFloat(numberMatch[1]);
          name = lineWithoutType.substring(0, numberMatch.index).trim();
          console.log('✅ Pattern 2 matched - Name:', name, 'Quantity:', quantity);
        } else {
          // Pattern 3: "Name [marked]" (no quantity, skip)
          console.warn('⚠️ No quantity found in line:', line);
          continue;
        }
      }

      if (name && quantity > 0) {
        ingredients.push({ name: name.toLowerCase(), quantity, inventoryType });
        console.log('✅ Added ingredient:', { name: name.toLowerCase(), quantity, inventoryType });
      }
    }

    console.log('📋 Final ingredients array:', ingredients);
    
    if (ingredients.length === 0) {
      console.warn('⚠️ No valid ingredients parsed');
      return;
    }

    // Get all marked foods and non-marked foods
    const markedFoodsPromise = firstValueFrom(this.browseService.getMarkedFoods());
    const allFoodsPromise = firstValueFrom(this.browseService.getFoods());

    const [markedFoods, allFoods] = await Promise.all([markedFoodsPromise, allFoodsPromise]);

    if (!markedFoods || !allFoods) {
      throw new Error('Failed to load inventory');
    }

    // Process each ingredient
    const updatePromises: Promise<any>[] = [];

    for (const ingredient of ingredients) {
      console.log(`🔄 Processing ingredient for restoration:`, ingredient);
      
      if (ingredient.inventoryType === 'marked') {
        // Find matching marked food - normalize both names for comparison
        const ingredientNameNormalized = ingredient.name.toLowerCase().trim();
        const markedFood = markedFoods.find(mf => {
          const foodNameNormalized = (mf.name || '').toLowerCase().trim();
          return foodNameNormalized === ingredientNameNormalized;
        });
        console.log(`🔍 Looking for marked food "${ingredient.name}" (normalized: "${ingredientNameNormalized}"):`, markedFood);
        console.log(`🔍 Available marked foods (full details):`, markedFoods);
        console.log(`🔍 Available marked foods (names only):`, markedFoods.map(mf => ({ 
          name: mf.name, 
          normalized: (mf.name || '').toLowerCase().trim(),
          qty: mf.qty,
          _id: mf._id
        })));
        
        if (markedFood && markedFood._id) {
          const newQty = (markedFood.qty || 0) + ingredient.quantity;
          console.log(`📈 Restoring marked food "${ingredient.name}": ${markedFood.qty} -> ${newQty}`);
          updatePromises.push(
            firstValueFrom(this.browseService.updateMarkedFoodQty(markedFood._id, newQty))
              .then(() => console.log(`✅ Successfully restored marked food "${ingredient.name}"`))
              .catch((err: any) => {
                console.error(`❌ Failed to restore marked food "${ingredient.name}":`, err);
                throw err;
              })
          );
        } else {
          console.warn(`⚠️ Marked food not found for restoration: ${ingredient.name}`);
          console.warn(`⚠️ Available marked foods:`, markedFoods.map(mf => mf.name));
          
          // If marked food doesn't exist, try to find it in non-marked foods and create a marked food entry
          console.log(`🔄 Trying to find "${ingredient.name}" in non-marked foods to create marked food entry...`);
          const nonMarkedFood = allFoods.find(f => {
            const foodNameNormalized = (f.name || '').toLowerCase().trim();
            return foodNameNormalized === ingredientNameNormalized;
          });
          
          if (nonMarkedFood && nonMarkedFood._id) {
            console.log(`✅ Found in non-marked foods, creating marked food entry:`, nonMarkedFood);
            // Create a new marked food entry with the restored quantity
            const newMarkedFoodData = {
              foodId: nonMarkedFood._id,
              name: nonMarkedFood.name,
              qty: ingredient.quantity,
              category: nonMarkedFood.category || 'Other',
              storage: nonMarkedFood.storage || 'Fridge',
              expiry: nonMarkedFood.expiry || '',
              notes: nonMarkedFood.notes || ''
            };
            updatePromises.push(
              firstValueFrom(this.browseService.markFood(newMarkedFoodData))
                .then(() => console.log(`✅ Successfully created marked food entry for "${ingredient.name}"`))
                .catch((err: any) => {
                  console.error(`❌ Failed to create marked food entry for "${ingredient.name}":`, err);
                  throw err;
                })
            );
          } else {
            // Neither marked nor non-marked food exists - create new non-marked food first, then marked food
            console.log(`🔄 Food "${ingredient.name}" not found in either marked or non-marked foods. Creating new food entry...`);
            
            // Create a new non-marked food with default values
            const defaultExpiry = new Date();
            defaultExpiry.setDate(defaultExpiry.getDate() + 7); // Default: 7 days from now
            
            const newFoodData = {
              name: ingredient.name, // Use original name (not normalized)
              qty: ingredient.quantity,
              category: 'Other', // Default category
              storage: 'Fridge', // Default storage
              expiry: defaultExpiry, // Date object for FoodService
              notes: 'Restored from meal plan deletion',
              owner: userId // Add owner field
            };
            
            // First create non-marked food, then create marked food entry
            updatePromises.push(
              firstValueFrom(this.foodService.addFood(newFoodData))
                .then((createdFood) => {
                  console.log(`✅ Successfully created non-marked food "${ingredient.name}"`);
                  
                  // Now create marked food entry
                  // Convert expiry Date to string for MarkedFood
                  let expiryString = '';
                  if (createdFood.expiry) {
                    if (createdFood.expiry instanceof Date) {
                      expiryString = createdFood.expiry.toISOString();
                    } else if (typeof createdFood.expiry === 'string') {
                      expiryString = createdFood.expiry;
                    } else {
                      expiryString = defaultExpiry.toISOString();
                    }
                  } else {
                    expiryString = defaultExpiry.toISOString();
                  }
                  
                  const newMarkedFoodData = {
                    foodId: createdFood._id!,
                    name: createdFood.name,
                    qty: ingredient.quantity,
                    category: createdFood.category || 'Other',
                    storage: createdFood.storage || 'Fridge',
                    expiry: expiryString, // String for MarkedFood
                    notes: createdFood.notes || 'Restored from meal plan deletion'
                  };
                  
                  return firstValueFrom(this.browseService.markFood(newMarkedFoodData));
                })
                .then(() => {
                  console.log(`✅ Successfully created marked food entry for "${ingredient.name}"`);
                })
                .catch((err: any) => {
                  console.error(`❌ Failed to create food entry for "${ingredient.name}":`, err);
                  throw err;
                })
            );
          }
        }
      } else {
        // Find matching non-marked food (current inventory) - normalize both names for comparison
        const ingredientNameNormalized = ingredient.name.toLowerCase().trim();
        const food = allFoods.find(f => {
          const foodNameNormalized = (f.name || '').toLowerCase().trim();
          return foodNameNormalized === ingredientNameNormalized;
        });
        console.log(`🔍 Looking for non-marked food "${ingredient.name}" (normalized: "${ingredientNameNormalized}"):`, food);
        console.log(`🔍 Available non-marked foods:`, allFoods.map(f => ({ 
          name: f.name, 
          normalized: (f.name || '').toLowerCase().trim(),
          qty: f.qty 
        })));
        
        if (food && food._id) {
          const newQty = (food.qty || 0) + ingredient.quantity;
          console.log(`📈 Restoring non-marked food "${ingredient.name}": ${food.qty} -> ${newQty}`);
          updatePromises.push(
            firstValueFrom(this.browseService.updateFoodQty(food._id, newQty))
              .then(() => console.log(`✅ Successfully restored non-marked food "${ingredient.name}"`))
              .catch((err: any) => {
                console.error(`❌ Failed to restore non-marked food "${ingredient.name}":`, err);
                throw err;
              })
          );
        } else {
          // Non-marked food doesn't exist - create new non-marked food
          console.log(`🔄 Non-marked food "${ingredient.name}" not found. Creating new food entry...`);
          
          // Create a new non-marked food with default values
          const defaultExpiry = new Date();
          defaultExpiry.setDate(defaultExpiry.getDate() + 7); // Default: 7 days from now
          
          const newFoodData = {
            name: ingredient.name, // Use original name (not normalized)
            qty: ingredient.quantity,
            category: 'Other', // Default category
            storage: 'Fridge', // Default storage
            expiry: defaultExpiry, // Date object for FoodService
            notes: 'Restored from meal plan deletion',
            owner: userId // Add owner field
          };
          
          updatePromises.push(
            firstValueFrom(this.foodService.addFood(newFoodData))
              .then(() => {
                console.log(`✅ Successfully created non-marked food "${ingredient.name}"`);
              })
              .catch((err: any) => {
                console.error(`❌ Failed to create non-marked food "${ingredient.name}":`, err);
                throw err;
              })
          );
        }
      }
    }

    // Wait for all updates to complete
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      console.log('✅ All ingredient quantities restored successfully');
    } else {
      console.warn('⚠️ No update promises to execute - no ingredients matched');
    }
  }

  getDaysUntilExpiry(expiry: string): number {
    if (!expiry) return 999; // No expiry date means far future
    
    try {
      // Parse expiry date (DD/MM/YYYY format)
      const expiryParts = expiry.split('/');
      if (expiryParts.length !== 3) return 999;
      
      const expiryDate = new Date(
        parseInt(expiryParts[2]), 
        parseInt(expiryParts[1]) - 1, 
        parseInt(expiryParts[0])
      );
      expiryDate.setHours(0, 0, 0, 0);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays;
    } catch (error) {
      return 999; // Error parsing date, return large number
    }
  }
}

