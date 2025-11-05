import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../sidebar/sidebar.component';

interface DayInfo {
  name: string;
  date: number;
  fullDate: Date;
  isCurrentMonth: boolean; // 현재 표시 중인 달인지 여부
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
  
  inventory: InventoryItem[] = [
    {
      name: 'Apple',
      quantity: 4,
      category: 'Fruit',
      marked: false,
      expiry: '12/11/2025'
    },
    {
      name: 'Avocado',
      quantity: 6,
      category: 'Fruit',
      marked: false,
      expiry: '25/11/2025'
    },
    {
      name: 'Banana',
      quantity: 2,
      category: 'Fruit',
      marked: false,
      expiry: '30/9/2025'
    },
    {
      name: 'Broccoli',
      quantity: 3,
      category: 'Vegetable',
      marked: false,
      expiry: '17/10/2025'
    },
    {
      name: 'Chicken',
      quantity: 3,
      category: 'Meat',
      marked: true,
      expiry: '19/9/2025'
    }
  ];
  
  filteredInventory: InventoryItem[] = [];

  constructor(private cdr: ChangeDetectorRef) {}

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
    this.filteredInventory = [...this.inventory];
  }

  initializeWeekDays() {
    // currentDate는 항상 주의 시작점(일요일)을 가리킴
    const startOfWeek = new Date(this.currentDate);
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    this.weekDays = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      
      // 현재 표시 중인 달(targetMonth)과 일치하는지 확인
      const isCurrentMonth = day.getMonth() === this.targetMonth && day.getFullYear() === this.targetYear;
      
      this.weekDays.push({
        name: dayNames[day.getDay()],
        date: day.getDate(),
        fullDate: day,
        isCurrentMonth: isCurrentMonth
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
}

