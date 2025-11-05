import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SidebarComponent } from '../sidebar/sidebar.component';

interface DayInfo {
  name: string;
  date: number;
  fullDate: Date;
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

  constructor() {}

  ngOnInit() {
    this.initializeWeekDays();
    this.filteredInventory = [...this.inventory];
  }

  initializeWeekDays() {
    const currentDay = this.currentDate.getDay();
    
    // Get the start of the current week (Sunday)
    const startOfWeek = new Date(this.currentDate);
    startOfWeek.setDate(this.currentDate.getDate() - currentDay);
    
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    this.weekDays = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      
      this.weekDays.push({
        name: dayNames[day.getDay()],
        date: day.getDate(),
        fullDate: day
      });
    }
    
    // Update month name
    this.currentMonth = startOfWeek.toLocaleString('default', { month: 'long' });
  }

  previousWeek() {
    this.currentDate.setDate(this.currentDate.getDate() - 7);
    this.initializeWeekDays();
  }

  nextWeek() {
    this.currentDate.setDate(this.currentDate.getDate() + 7);
    this.initializeWeekDays();
  }

  previousMonth() {
    // 현재 주의 요일 이름과 날짜 숫자를 완전히 고정 (절대 변경하지 않음)
    const currentDayNames = this.weekDays.map(day => day.name); // 요일 이름 고정 (Sun, Mon, Tue...)
    const currentDates = this.weekDays.map(day => day.date); // 날짜 숫자 고정 (18, 19, 20...)
    const firstDayOfWeek = this.weekDays[0].fullDate;
    
    // 이전 달로 이동
    const newMonth = firstDayOfWeek.getMonth() - 1;
    const newYear = newMonth < 0 ? firstDayOfWeek.getFullYear() - 1 : firstDayOfWeek.getFullYear();
    const actualNewMonth = newMonth < 0 ? 11 : newMonth;
    
    // 주의 요일 이름과 날짜 숫자를 완전히 고정하면서 월만 변경
    this.weekDays = [];
    for (let i = 0; i < 7; i++) {
      // 날짜 숫자 완전히 고정 (조정하지 않음)
      const targetDate = currentDates[i];
      const day = new Date(newYear, actualNewMonth, targetDate);
      
      this.weekDays.push({
        name: currentDayNames[i], // 원래 요일 이름 그대로 사용 (완전 고정)
        date: targetDate, // 원래 날짜 숫자 그대로 사용 (완전 고정)
        fullDate: day
      });
    }
    
    // 월 이름만 업데이트
    this.currentDate = this.weekDays[0].fullDate;
    this.currentMonth = this.currentDate.toLocaleString('default', { month: 'long' });
  }

  nextMonth() {
    // 현재 주의 요일 이름과 날짜 숫자를 완전히 고정 (절대 변경하지 않음)
    const currentDayNames = this.weekDays.map(day => day.name); // 요일 이름 고정 (Sun, Mon, Tue...)
    const currentDates = this.weekDays.map(day => day.date); // 날짜 숫자 고정 (18, 19, 20...)
    const firstDayOfWeek = this.weekDays[0].fullDate;
    
    // 다음 달로 이동
    const newMonth = firstDayOfWeek.getMonth() + 1;
    const newYear = newMonth > 11 ? firstDayOfWeek.getFullYear() + 1 : firstDayOfWeek.getFullYear();
    const actualNewMonth = newMonth > 11 ? 0 : newMonth;
    
    // 주의 요일 이름과 날짜 숫자를 완전히 고정하면서 월만 변경
    this.weekDays = [];
    for (let i = 0; i < 7; i++) {
      // 날짜 숫자 완전히 고정 (조정하지 않음)
      const targetDate = currentDates[i];
      const day = new Date(newYear, actualNewMonth, targetDate);
      
      this.weekDays.push({
        name: currentDayNames[i], // 원래 요일 이름 그대로 사용 (완전 고정)
        date: targetDate, // 원래 날짜 숫자 그대로 사용 (완전 고정)
        fullDate: day
      });
    }
    
    // 월 이름만 업데이트
    this.currentDate = this.weekDays[0].fullDate;
    this.currentMonth = this.currentDate.toLocaleString('default', { month: 'long' });
  }

  previousDay() {
    // 현재 주의 첫날을 기준으로 하루 전으로 이동
    const firstDayOfWeek = new Date(this.weekDays[0].fullDate);
    firstDayOfWeek.setDate(firstDayOfWeek.getDate() - 1);
    this.currentDate = firstDayOfWeek;
    this.initializeWeekDays();
  }

  nextDay() {
    // 현재 주의 첫날을 기준으로 하루 후로 이동
    const firstDayOfWeek = new Date(this.weekDays[0].fullDate);
    firstDayOfWeek.setDate(firstDayOfWeek.getDate() + 1);
    this.currentDate = firstDayOfWeek;
    this.initializeWeekDays();
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

