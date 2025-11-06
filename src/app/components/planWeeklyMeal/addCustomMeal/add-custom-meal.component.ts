import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';

interface InventoryItem {
  name: string;
  quantity: number;
  category: string;
  marked: boolean;
  expiry: string;
}

@Component({
  selector: 'app-add-custom-meal',
  standalone: true,
  templateUrl: './add-custom-meal.component.html',
  styleUrls: ['./add-custom-meal.component.css'],
  imports: [CommonModule, FormsModule, SidebarComponent]
})
export class AddCustomMealComponent implements OnInit {
  foodPhoto: string | null = null;
  foodName: string = '';
  ingredients: string = '';
  howToCook: string = '';
  kcal: string = '';
  
  selectedDate: string = '';
  selectedMealType: string = '';

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

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    // Query parameters에서 선택된 날짜와 meal type 받기
    this.route.queryParams.subscribe(params => {
      this.selectedDate = params['date'] || '';
      this.selectedMealType = params['mealType'] || '';
    });
    
    // Initialize filtered inventory
    this.filteredInventory = [...this.inventory];
  }

  onPhotoChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.foodPhoto = e.target.result;
      };
      reader.readAsDataURL(input.files[0]);
    }
  }

  triggerPhotoUpload() {
    const input = document.getElementById('photo-upload') as HTMLInputElement;
    if (input) {
      input.click();
    }
  }

  removePhoto() {
    this.foodPhoto = null;
  }

  createMeal() {
    if (!this.foodName.trim()) {
      alert('Please enter a food name');
      return;
    }

    // TODO: 실제로 meal 데이터를 저장하는 로직 구현
    // 현재는 콘솔에 출력하고 이전 페이지로 돌아감
    const mealData = {
      date: this.selectedDate,
      mealType: this.selectedMealType,
      foodName: this.foodName,
      ingredients: this.ingredients,
      howToCook: this.howToCook,
      kcal: this.kcal,
      photo: this.foodPhoto
    };

    console.log('Meal created:', mealData);
    
    // 이전 페이지로 돌아가기
    this.router.navigate(['/planWeeklyMeal']);
  }

  back() {
    this.router.navigate(['/planWeeklyMeal']);
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

