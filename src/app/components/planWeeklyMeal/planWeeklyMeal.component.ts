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
    
    // 주에 가장 많은 날짜가 있는 달을 targetMonth로 업데이트
    const monthCounts = new Map<number, { count: number; year: number }>();
    for (const day of this.weekDays) {
      const month = day.fullDate.getMonth();
      const year = day.fullDate.getFullYear();
      const key = month;
      if (!monthCounts.has(key) || monthCounts.get(key)!.year !== year) {
        monthCounts.set(key, { count: 0, year: year });
      }
      monthCounts.get(key)!.count++;
    }
    
    // 가장 많은 날짜를 가진 달 찾기
    let maxCount = 0;
    let maxMonth = this.targetMonth;
    let maxYear = this.targetYear;
    for (const [month, data] of monthCounts.entries()) {
      if (data.count > maxCount) {
        maxCount = data.count;
        maxMonth = month;
        maxYear = data.year;
      }
    }
    
    // targetMonth와 targetYear 업데이트
    this.targetMonth = maxMonth;
    this.targetYear = maxYear;
    
    // Update month name
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
    
    // 해당 달의 1일을 찾고, 그 주의 일요일을 찾기
    const firstDayOfMonth = new Date(newYear, actualNewMonth, 1);
    const dayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
    const startOfWeek = new Date(firstDayOfMonth);
    startOfWeek.setDate(firstDayOfMonth.getDate() - dayOfWeek); // 일요일로 이동
    
    // 목표 달과 연도 업데이트
    this.targetMonth = actualNewMonth;
    this.targetYear = newYear;
    
    // 해당 달의 첫 주를 표시
    this.currentDate = new Date(startOfWeek);
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
    
    // 해당 달의 1일을 찾고, 그 주의 일요일을 찾기
    const firstDayOfMonth = new Date(newYear, actualNewMonth, 1);
    const dayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
    const startOfWeek = new Date(firstDayOfMonth);
    startOfWeek.setDate(firstDayOfMonth.getDate() - dayOfWeek); // 일요일로 이동
    
    // 목표 달과 연도 업데이트
    this.targetMonth = actualNewMonth;
    this.targetYear = newYear;
    
    // 해당 달의 첫 주를 표시
    this.currentDate = new Date(startOfWeek);
    this.initializeWeekDays();
    
    this.cdr.detectChanges();
  }

  previousDay(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // currentDate는 주의 시작점(일요일)을 가리킴
    // 하루 전으로 이동 = 이전 주의 일요일로 이동
    const newDate = new Date(this.currentDate);
    newDate.setDate(newDate.getDate() - 7);
    
    // 새로운 날짜의 월과 연도 확인
    const newMonth = newDate.getMonth();
    const newYear = newDate.getFullYear();
    
    // targetMonth와 targetYear 업데이트
    this.targetMonth = newMonth;
    this.targetYear = newYear;
    this.currentDate = new Date(newDate);
    
    this.initializeWeekDays();
    this.cdr.detectChanges();
  }

  nextDay(event?: Event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    
    // currentDate는 주의 시작점(일요일)을 가리킴
    // 하루 후로 이동 = 다음 주의 일요일로 이동
    const newDate = new Date(this.currentDate);
    newDate.setDate(newDate.getDate() + 7);
    
    // 새로운 날짜의 월과 연도 확인
    const newMonth = newDate.getMonth();
    const newYear = newDate.getFullYear();
    
    // targetMonth와 targetYear 업데이트
    this.targetMonth = newMonth;
    this.targetYear = newYear;
    this.currentDate = new Date(newDate);
    
    this.initializeWeekDays();
    this.cdr.detectChanges();
  }

  // 주에 가장 많은 날짜가 있는 달을 targetMonth로 업데이트
  updateTargetMonthFromWeek() {
    const monthCounts = new Map<number, { count: number; year: number }>();
    
    this.weekDays.forEach(day => {
      const month = day.fullDate.getMonth();
      const year = day.fullDate.getFullYear();
      const key = year * 12 + month;
      
      if (!monthCounts.has(key)) {
        monthCounts.set(key, { count: 0, year: year });
      }
      monthCounts.get(key)!.count++;
    });
    
    let maxKey = -1;
    let maxCount = 0;
    
    monthCounts.forEach((value, key) => {
      if (value.count > maxCount) {
        maxCount = value.count;
        maxKey = key;
      }
    });
    
    if (maxKey >= 0) {
      const maxValue = monthCounts.get(maxKey)!;
      const newTargetYear = maxValue.year;
      const newTargetMonth = maxKey % 12;
      
      // 달이 변경되었고, 새 달의 첫 날이 주에 포함되어 있으면 해당 달의 첫 주로 이동
      if (this.targetMonth !== newTargetMonth || this.targetYear !== newTargetYear) {
        const firstDayOfNewMonth = new Date(newTargetYear, newTargetMonth, 1);
        const dayOfWeek = firstDayOfNewMonth.getDay(); // 0 = Sunday
        const startOfWeek = new Date(firstDayOfNewMonth);
        startOfWeek.setDate(firstDayOfNewMonth.getDate() - dayOfWeek);
        
        // 새 달의 첫 날이 현재 주에 포함되어 있는지 확인
        const isFirstDayInWeek = this.weekDays.some(day => 
          day.fullDate.getDate() === 1 && 
          day.fullDate.getMonth() === newTargetMonth &&
          day.fullDate.getFullYear() === newTargetYear
        );
        
        if (isFirstDayInWeek) {
          // 새 달의 첫 주로 이동
          this.targetYear = newTargetYear;
          this.targetMonth = newTargetMonth;
          this.currentDate = new Date(startOfWeek);
          this.initializeWeekDays();
          return;
        }
      }
      
      this.targetYear = newTargetYear;
      this.targetMonth = newTargetMonth;
      
      // weekDays 배열을 새로 만들어서 변경 감지 트리거
      const updatedWeekDays = this.weekDays.map(day => ({
        ...day,
        isCurrentMonth: day.fullDate.getMonth() === this.targetMonth && 
                        day.fullDate.getFullYear() === this.targetYear
      }));
      
      this.weekDays = updatedWeekDays;
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

