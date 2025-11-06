import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { FoodService, Food } from '../../services/food.service';

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
  name: string;
  quantity: number;
  category: string;
  marked: boolean;
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

  constructor(
    private cdr: ChangeDetectorRef,
    private router: Router,
    private foodService: FoodService
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

    this.foodService.getFoods(userId).subscribe({
      next: (data: Food[]) => {
        // status가 'inventory'인 항목만 필터링하고 InventoryItem 형식으로 변환
        this.inventory = data
          .filter((f: any) => f.owner === userId && f.status === 'inventory')
          .map((food: any) => {
            // expiry 날짜 포맷팅 (Date 객체를 DD/MM/YYYY 형식으로)
            let expiryStr = '';
            if (food.expiry) {
              const expiryDate = new Date(food.expiry);
              const day = String(expiryDate.getDate()).padStart(2, '0');
              const month = String(expiryDate.getMonth() + 1).padStart(2, '0');
              const year = expiryDate.getFullYear();
              expiryStr = `${day}/${month}/${year}`;
            }

            return {
              name: food.name,
              quantity: food.qty || 0,
              category: food.category || 'Other',
              marked: food.marked || false,
              expiry: expiryStr
            };
          });
        
        this.filteredInventory = [...this.inventory];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading inventory:', err);
        this.inventory = [];
        this.filteredInventory = [];
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
    if (!this.searchTerm.trim()) {
      this.filteredInventory = [...this.inventory];
    } else {
      this.filteredInventory = this.inventory.filter(item =>
        item.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(this.searchTerm.toLowerCase())
      );
    }
  }

  toggleFilter() {
    // Toggle filter functionality can be implemented here
    console.log('Filter toggled');
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
    
    if (this.selectedDay && this.selectedMealType) {
      // TODO: 레시피 브라우저 표시
      console.log('Browse recipes for', this.selectedDay.date, this.selectedMealType);
      this.closeMealOptions();
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
}

