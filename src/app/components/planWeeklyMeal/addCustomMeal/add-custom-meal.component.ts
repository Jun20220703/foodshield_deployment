import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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

  // Filter
  showFilter: boolean = false;
  selectedCategories: Set<string> = new Set();
  expiryFilterDays: number | null = null; // null = no filter, number = days until expiry
  availableCategories: string[] = []; // Will be populated from actual inventory data

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private foodService: FoodService,
    private browseService: BrowseFoodService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Query parameters에서 선택된 날짜와 meal type 받기
    this.route.queryParams.subscribe(params => {
      this.selectedDate = params['date'] || '';
      this.selectedMealType = params['mealType'] || '';
    });
    
    // CRITICAL: Ensure filter drawer is closed by default
    this.showFilter = false;
    
    // Initialize with empty arrays to prevent undefined errors
    this.inventory = [];
    this.filteredInventory = [];
    this.paginatedInventory = [];
    
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
        console.log('📦 Inventory loaded:', this.inventory.length, 'items');
        
        // CRITICAL FIX: On initial load, skip ALL filtering and show ALL items immediately
        // Set filteredInventory directly to all items
        this.filteredInventory = [...this.inventory];
        console.log('✅ filteredInventory set to ALL items:', this.filteredInventory.length);
        
        // Update available categories for filter UI (but don't apply filters yet)
        this.updateAvailableCategories();
        console.log('📋 Available categories:', this.availableCategories);
        console.log('✅ Selected categories:', Array.from(this.selectedCategories));
        
        // CRITICAL: Set paginatedInventory DIRECTLY without calling applyFilters
        // This ensures items are visible immediately on page load
        this.currentPage = 1;
        if (this.filteredInventory.length > 0) {
          const startIndex = 0;
          const endIndex = Math.min(this.itemsPerPage, this.filteredInventory.length);
          this.paginatedInventory = this.filteredInventory.slice(startIndex, endIndex);
          this.totalPages = Math.ceil(this.filteredInventory.length / this.itemsPerPage);
          console.log('✅ paginatedInventory set DIRECTLY:', this.paginatedInventory.length, 'items');
          console.log('✅ Total pages:', this.totalPages);
          console.log('✅ Items to display:', this.paginatedInventory.map(i => i.name));
          
          // CRITICAL: Force Angular to detect changes and update UI
          setTimeout(() => {
            this.cdr.detectChanges();
            console.log('✅ Change detection triggered');
          }, 0);
        } else {
          this.paginatedInventory = [];
          this.totalPages = 1;
          console.log('⚠️ No items to display');
          setTimeout(() => {
            this.cdr.detectChanges();
          }, 0);
        }
      },
      error: (err) => {
        console.error('❌ Error loading marked foods:', err);
        this.inventory = [];
        this.filteredInventory = [];
        this.paginatedInventory = [];
        this.totalPages = 1;
        this.currentPage = 1;
        this.availableCategories = [];
        this.selectedCategories.clear();
        this.updatePagination();
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
    this.applyFilters();
  }

  updatePagination() {
    // Ensure filteredInventory exists
    if (!this.filteredInventory) {
      this.filteredInventory = [];
    }
    
    this.totalPages = Math.ceil(this.filteredInventory.length / this.itemsPerPage);
    if (this.totalPages === 0) {
      this.totalPages = 1;
      this.currentPage = 1;
      this.paginatedInventory = [];
    } else {
      if (this.currentPage > this.totalPages) {
        this.currentPage = this.totalPages;
      }
      const startIndex = (this.currentPage - 1) * this.itemsPerPage;
      const endIndex = startIndex + this.itemsPerPage;
      this.paginatedInventory = this.filteredInventory.slice(startIndex, endIndex);
    }
    console.log('📄 Pagination updated - filteredInventory:', this.filteredInventory.length, 'items');
    console.log('📄 Pagination updated - Page', this.currentPage, 'of', this.totalPages);
    console.log('📄 Pagination updated - paginatedInventory:', this.paginatedInventory.length, 'items');
    console.log('📄 Paginated items:', this.paginatedInventory.map(i => i.name));
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
    this.applyFilters();
  }

  onCategoryAllToggle(checked: boolean) {
    if (checked) {
      this.selectedCategories = new Set(this.availableCategories);
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
    // If inventory is empty, clear filteredInventory
    if (this.inventory.length === 0) {
      this.filteredInventory = [];
      this.updatePagination();
      return;
    }

    // Start with ALL items from inventory
    let filtered = [...this.inventory];
    console.log('🔍 applyFilters - Starting with', filtered.length, 'items');

    // Category filter - ONLY apply if SOME (but not all) categories are selected
    // If NO categories selected OR ALL categories selected, show ALL items
    if (this.availableCategories.length > 0) {
      const allSelected = this.selectedCategories.size === this.availableCategories.length;
      const noneSelected = this.selectedCategories.size === 0;
      
      // Only filter if some (but not all) categories are selected
      if (!allSelected && !noneSelected && this.selectedCategories.size > 0) {
        console.log('🔍 Applying category filter:', Array.from(this.selectedCategories));
        filtered = filtered.filter(item => this.selectedCategories.has(item.category));
        console.log('🔍 After category filter:', filtered.length, 'items');
      } else {
        // If all categories selected or none selected, show all items
        console.log('🔍 No category filter - allSelected:', allSelected, 'noneSelected:', noneSelected, '- showing all items');
      }
    } else {
      // No categories available, show all items
      console.log('🔍 No categories available, showing all items');
    }

    // Expiry filter
    if (this.expiryFilterDays !== null && this.expiryFilterDays !== undefined) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const filterDate = new Date(today);
      filterDate.setDate(today.getDate() + this.expiryFilterDays);

      filtered = filtered.filter(item => {
        if (!item.expiry) return false;
        const expiryDate = new Date(item.expiry.split('/').reverse().join('-'));
        expiryDate.setHours(0, 0, 0, 0);
        return expiryDate <= filterDate;
      });
    }

    // Search filter
    if (this.searchTerm.trim()) {
      const searchLower = this.searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchLower) ||
        item.category.toLowerCase().includes(searchLower)
      );
    }

    this.filteredInventory = filtered;
    this.currentPage = 1; // Reset to first page when filtering
    this.updatePagination();
  }

  resetFilters() {
    this.selectedCategories = new Set(this.availableCategories);
    this.expiryFilterDays = null;
    this.searchTerm = '';
    this.applyFilters();
  }

  updateAvailableCategories() {
    const categories = new Set<string>();
    this.inventory.forEach(item => {
      if (item.category) {
        categories.add(item.category);
      }
    });
    this.availableCategories = Array.from(categories).sort();
    
    // CRITICAL: ALWAYS initialize selectedCategories with ALL available categories
    // This ensures ALL items are visible by default when page loads
    // We MUST do this EVERY TIME to ensure all items are shown
    if (this.availableCategories.length > 0) {
      // Force reset to all categories - don't check if empty, just always set it
      this.selectedCategories = new Set(this.availableCategories);
      console.log('✅ FORCED selectedCategories initialization with ALL categories:', Array.from(this.selectedCategories));
      console.log('✅ Total categories:', this.availableCategories.length, 'Selected:', this.selectedCategories.size);
    } else {
      // If no categories, clear selectedCategories
      this.selectedCategories.clear();
      console.log('⚠️ No categories available');
    }
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

