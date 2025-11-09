import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { FoodService, Food } from '../../../services/food.service';
import { BrowseFoodService, MarkedFood } from '../../../services/browse-food.service';

interface InventoryItem {
  name: string;
  quantity: number;
  category: string;
  marked: boolean;
  expiry: string;
  foodId?: string; // Add foodId for merging
  markedQuantity?: number; // Add markedQuantity
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

  inventory: InventoryItem[] = [];
  filteredInventory: InventoryItem[] = [];
  
  // Pagination
  itemsPerPage: number = 10;
  currentPage: number = 1;
  paginatedInventory: InventoryItem[] = [];
  totalPages: number = 1;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private foodService: FoodService,
    private browseService: BrowseFoodService
  ) {}

  ngOnInit() {
    // Query parameters에서 선택된 날짜와 meal type 받기
    this.route.queryParams.subscribe(params => {
      this.selectedDate = params['date'] || '';
      this.selectedMealType = params['mealType'] || '';
    });
    
    // Load inventory from database
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

    // Load only marked foods (same as planWeeklyMeal page)
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

          // Handle foodId - it might be an object if populated, or a string
          let foodIdStr = '';
          const foodIdValue = (markedFood as any).foodId;
          
          if (typeof foodIdValue === 'string') {
            foodIdStr = foodIdValue;
          } else if (foodIdValue && typeof foodIdValue === 'object' && foodIdValue._id) {
            foodIdStr = foodIdValue._id;
          } else if (foodIdValue) {
            foodIdStr = String(foodIdValue);
          }

          // Use exact qty from database
          const dbQty = markedFood.qty || 0;

          return {
            foodId: foodIdStr,
            name: markedFood.name,
            quantity: dbQty, // Exact quantity from database
            category: markedFood.category || 'Other',
            marked: true,
            markedQuantity: dbQty, // Exact marked quantity from database
            expiry: expiryStr
          };
        });

        // Merge marked items with same foodId (same food item marked multiple times)
        const markedItemsByFoodId = new Map<string, InventoryItem>();
        markedItems.forEach(item => {
          const foodId = item.foodId;
          if (!foodId) {
            return;
          }
          
          const existing = markedItemsByFoodId.get(foodId);
          if (existing) {
            // If same foodId exists, sum quantities from database
            existing.quantity += item.quantity;
            existing.markedQuantity = (existing.markedQuantity || 0) + item.markedQuantity;
          } else {
            // Add new item
            markedItemsByFoodId.set(foodId, { ...item });
          }
        });

        this.inventory = Array.from(markedItemsByFoodId.values());
        this.filteredInventory = [...this.inventory];
        this.updatePagination();
      },
      error: (err) => {
        console.error('Error loading marked foods:', err);
        this.inventory = [];
        this.filteredInventory = [];
      }
    });
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
    this.currentPage = 1; // Reset to first page when filtering
    this.updatePagination();
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
    // Toggle filter functionality can be implemented here
    console.log('Filter toggled');
  }

  selectItem(index: number) {
    this.selectedItemIndex = index;
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
}

