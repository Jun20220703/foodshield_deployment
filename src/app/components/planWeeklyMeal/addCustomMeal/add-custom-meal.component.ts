import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { FoodService } from '../../../services/food.service';
import { BrowseFoodService, MarkedFood, Food } from '../../../services/browse-food.service';
import { CustomMealService, CustomMeal } from '../../../services/custom-meal.service';

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
  remark: string = '';
  kcal: string = '';
  
  // Ingredients with quantities
  ingredientList: Array<{ name: string; quantity: string }> = [{ name: '', quantity: '' }];
  
  selectedDate: string = '';
  selectedMealType: string = '';
  isEditMode: boolean = false;
  editMealId: string | null = null;

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
  
  // Inventory type selection
  inventoryType: 'marked' | 'non-marked' = 'marked';

  // Ingredient selection modal
  showIngredientModal: boolean = false;
  selectedIngredientQuantity: { [key: string]: number } = {}; // Store selected quantities for each ingredient
  isLoadingInventory: boolean = false; // Loading state for inventory

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private foodService: FoodService,
    private browseService: BrowseFoodService,
    private customMealService: CustomMealService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    // Query parameters에서 선택된 날짜와 meal type 받기
    this.route.queryParams.subscribe(params => {
      this.selectedDate = params['date'] || '';
      this.selectedMealType = params['mealType'] || '';
      this.isEditMode = params['edit'] === 'true';
      this.editMealId = params['id'] || null;
      
      // Edit 모드이고 id가 있으면 기존 데이터 로드
      if (this.isEditMode && this.editMealId) {
        this.loadExistingMeal(this.editMealId);
      } else {
        // Not in edit mode, ensure ingredientList is initialized
        if (this.ingredientList.length === 0) {
          this.ingredientList = [{ name: '', quantity: '' }];
        }
      }
    });
    
    // CRITICAL: Ensure filter drawer is closed by default
    this.showFilter = false;
    
    // Initialize with empty arrays to prevent undefined errors
    this.inventory = [];
    this.filteredInventory = [];
    this.paginatedInventory = [];
    
    // Ensure ingredientList has at least one row (if not in edit mode)
    if (!this.isEditMode && this.ingredientList.length === 0) {
      this.ingredientList = [{ name: '', quantity: '' }];
    }
    
    // Load inventory from database
    this.loadInventory();
    
    // Force change detection to ensure UI updates
    setTimeout(() => {
      this.cdr.detectChanges();
    }, 0);
  }

  // 기존 meal 데이터 로드
  loadExistingMeal(mealId: string) {
    this.customMealService.getCustomMealById(mealId).subscribe({
      next: (meal: CustomMeal) => {
        console.log('✅ Existing meal loaded:', meal);
        // 폼 필드에 기존 데이터 채우기
        this.foodName = meal.foodName || '';
        this.ingredients = meal.ingredients || '';
        this.remark = meal.remark || '';
        this.kcal = meal.kcal || '';
        this.foodPhoto = meal.photo || null;
        this.selectedDate = meal.date || this.selectedDate;
        this.selectedMealType = meal.mealType || this.selectedMealType;
        
        // Parse ingredients string into ingredientList
        this.parseIngredientsToList(meal.ingredients || '');
        
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading existing meal:', err);
        alert('Failed to load meal data. Please try again.');
      }
    });
  }

  // Parse ingredients string into ingredientList
  parseIngredientsToList(ingredientsStr: string) {
    this.ingredientList = [];
    
    if (!ingredientsStr || !ingredientsStr.trim()) {
      // If empty, add one empty row
      this.ingredientList.push({ name: '', quantity: '' });
      return;
    }
    
    // Split by newline or comma
    const lines = ingredientsStr.split(/[\n,]/).map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) {
      this.ingredientList.push({ name: '', quantity: '' });
      return;
    }
    
    // Parse each line: "Ingredient Name 200g" or "Ingredient Name" or "Ingredient Name, 200g"
    lines.forEach(line => {
      // Try to extract quantity (numbers followed by units like g, kg, ml, l, tbsp, tsp, cup, cups, oz, lb)
      const quantityMatch = line.match(/\s+(\d+(?:\.\d+)?)\s*(g|kg|ml|l|tbsp|tsp|cup|cups|oz|lb|개|조각|컵|스푼|작은술|큰술)\s*$/i);
      
      if (quantityMatch) {
        const quantity = quantityMatch[1] + quantityMatch[2];
        const name = line.substring(0, quantityMatch.index).trim();
        this.ingredientList.push({ name, quantity });
      } else {
        // No quantity found, check if there's a number at the end
        const numberMatch = line.match(/\s+(\d+(?:\.\d+)?)\s*$/);
        if (numberMatch) {
          const quantity = numberMatch[1];
          const name = line.substring(0, numberMatch.index).trim();
          this.ingredientList.push({ name, quantity });
        } else {
          // Just ingredient name, no quantity
          this.ingredientList.push({ name: line, quantity: '' });
        }
      }
    });
    
    // If no ingredients parsed, add one empty row
    if (this.ingredientList.length === 0) {
      this.ingredientList.push({ name: '', quantity: '' });
    }
  }

  // Convert ingredientList to ingredients string for database
  convertIngredientsListToString(): string {
    return this.ingredientList
      .filter(ing => ing.name.trim().length > 0)
      .map(ing => {
        const name = ing.name.trim();
        const qty = ing.quantity.trim();
        return qty ? `${name} ${qty}` : name;
      })
      .join('\n');
  }

  // Add new ingredient row
  addIngredient() {
    this.ingredientList.push({ name: '', quantity: '' });
  }

  // Remove ingredient row
  removeIngredient(index: number) {
    if (this.ingredientList.length > 1) {
      this.ingredientList.splice(index, 1);
    } else {
      // If only one row, just clear it
      this.ingredientList[0] = { name: '', quantity: '' };
    }
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
    this.isLoadingInventory = true;
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
        
        // Set filteredInventory directly to all items
        this.filteredInventory = [...this.inventory];
        console.log('✅ filteredInventory set to ALL items:', this.filteredInventory.length);
        
        // Update available categories
        this.updateAvailableCategories();
        console.log('📋 Available categories:', this.availableCategories);
        
        // Apply filters to ensure filteredInventory is correct
        this.applyFilters();
        
        // Clear loading state
        this.isLoadingInventory = false;
        
        // Force immediate UI update
        this.cdr.markForCheck();
        this.cdr.detectChanges();
        this.ngZone.run(() => {
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        console.error('❌ Error loading marked foods:', err);
        this.isLoadingInventory = false;
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

        // Set filteredInventory directly to all items
        this.filteredInventory = [...this.inventory];
        console.log('✅ filteredInventory set to ALL items:', this.filteredInventory.length);

        // Update available categories
        this.updateAvailableCategories();
        console.log('📋 Available categories:', this.availableCategories);

        // Apply filters to ensure filteredInventory is correct
        this.applyFilters();
        
        // Clear loading state
        this.isLoadingInventory = false;
        
        // Force immediate UI update
        this.cdr.markForCheck();
        this.cdr.detectChanges();
        this.ngZone.run(() => {
          this.cdr.markForCheck();
          this.cdr.detectChanges();
        });
      },
      error: (err) => {
        console.error('❌ Error loading Current Inventory:', err);
        this.isLoadingInventory = false;
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

  onInventoryTypeChange() {
    // Set loading state without clearing data immediately
    this.isLoadingInventory = true;
    
    // Reset filters
    this.searchTerm = '';
    this.selectedCategories.clear();
    this.expiryFilterDays = null;
    
    // Force immediate UI update to show loading state
    this.cdr.markForCheck();
    this.cdr.detectChanges();
    
    // Load new inventory immediately within Angular zone
    this.ngZone.run(() => {
      this.loadInventory();
    });
  }

  onPhotoChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      
      // 파일 크기 제한 (5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        alert('Image size is too large. Please select an image smaller than 5MB.');
        input.value = ''; // Reset input
        return;
      }
      
      // 이미지 파일인지 확인
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        input.value = ''; // Reset input
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const base64String = e.target.result as string;
        
        // Base64 문자열이 너무 길면 압축 시도
        if (base64String.length > 1000000) { // 약 1MB
          console.warn('⚠️ Image is large, compressing...');
          this.compressImage(base64String).then(compressed => {
            this.foodPhoto = compressed;
            this.cdr.detectChanges();
          }).catch(err => {
            console.error('❌ Error compressing image:', err);
            // 압축 실패해도 원본 사용
            this.foodPhoto = base64String;
            this.cdr.detectChanges();
          });
        } else {
          this.foodPhoto = base64String;
          this.cdr.detectChanges();
        }
      };
      
      reader.onerror = (error) => {
        console.error('❌ Error reading file:', error);
        alert('Failed to read image file. Please try again.');
        input.value = ''; // Reset input
      };
      
      reader.readAsDataURL(file);
    }
  }

  // 이미지 압축 (간단한 방법: canvas 사용)
  compressImage(base64String: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        
        // 최대 크기 설정 (800px)
        const maxWidth = 800;
        const maxHeight = 800;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // JPEG로 압축 (품질 0.8)
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        resolve(compressedBase64);
      };
      
      img.onerror = (error) => {
        reject(error);
      };
      
      img.src = base64String;
    });
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

    // Get user ID from localStorage
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user.id;

    if (!userId) {
      alert('User ID not found. Please log in again.');
      return;
    }

    // Validate date and mealType
    if (!this.selectedDate || !this.selectedMealType) {
      alert('Date and meal type are required. Please go back and select a date and meal type.');
      return;
    }

    // Convert ingredientList to string format for database
    const ingredientsString = this.convertIngredientsListToString();
    
    // Prepare meal data
    const mealData: CustomMeal = {
      foodName: this.foodName.trim(),
      ingredients: ingredientsString,
      remark: this.remark.trim(),
      kcal: this.kcal.trim(),
      photo: this.foodPhoto || null,
      date: this.selectedDate, // YYYY-MM-DD format
      mealType: this.selectedMealType, // Breakfast, Lunch, Dinner, Snack
      owner: userId
    };

    // Photo 크기 확인 및 로깅
    if (mealData.photo) {
      const photoSize = mealData.photo.length;
      console.log('📸 Photo size:', photoSize, 'characters');
      if (photoSize > 2000000) { // 약 2MB
        console.warn('⚠️ Photo is very large, this may cause issues');
      }
    }

    // Edit 모드인지 확인
    if (this.isEditMode && this.editMealId) {
      // Update existing meal
      console.log('🟢 Updating custom meal:', { ...mealData, photo: mealData.photo ? `[Base64 string ${mealData.photo.length} chars]` : null });
      this.customMealService.updateCustomMeal(this.editMealId, mealData).subscribe({
        next: (updatedMeal) => {
          console.log('✅ Custom meal updated successfully:', updatedMeal);
          alert('Custom meal updated successfully!');
          
          // Navigate back to planWeeklyMeal page
          this.router.navigate(['/planWeeklyMeal']);
        },
        error: (err) => {
          console.error('❌ Error updating custom meal:', err);
          console.error('❌ Error details:', JSON.stringify(err, null, 2));
          const errorMessage = err.error?.message || err.message || 'Unknown error';
          alert(`Failed to update custom meal: ${errorMessage}`);
        }
      });
    } else {
      // Create new meal
      console.log('🟢 Creating custom meal:', { ...mealData, photo: mealData.photo ? `[Base64 string ${mealData.photo.length} chars]` : null });
      this.customMealService.createCustomMeal(mealData).subscribe({
        next: (savedMeal) => {
          console.log('✅ Custom meal created successfully:', savedMeal);
          alert('Custom meal created successfully!');
          
          // Navigate back to planWeeklyMeal page
          this.router.navigate(['/planWeeklyMeal']);
        },
        error: (err) => {
          console.error('❌ Error creating custom meal:', err);
          console.error('❌ Error details:', JSON.stringify(err, null, 2));
          const errorMessage = err.error?.message || err.message || 'Unknown error';
          alert(`Failed to create custom meal: ${errorMessage}`);
        }
      });
    }
  }

  back() {
    this.router.navigate(['/planWeeklyMeal']);
  }

  filterInventory() {
    this.applyFilters();
  }

  onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchTerm = input.value;
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
    
    // Force UI update after pagination changes
    this.cdr.markForCheck();
    this.cdr.detectChanges();
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

    // Search filter - Only search by name, not category
    if (this.searchTerm && this.searchTerm.trim().length > 0) {
      const searchLower = this.searchTerm.trim().toLowerCase();
      console.log('🔍 Applying search filter with term:', searchLower);
      const beforeSearchCount = filtered.length;
      filtered = filtered.filter(item => {
        return item.name && item.name.toLowerCase().includes(searchLower);
      });
      console.log('🔍 After search filter:', filtered.length, 'items (was', beforeSearchCount, ')');
    }

    this.filteredInventory = filtered;
    this.currentPage = 1; // Reset to first page when filtering
    this.updatePagination();
    console.log('🔍 Final filteredInventory:', this.filteredInventory.length, 'items');
    
    // Force UI update after filtering
    this.cdr.markForCheck();
    this.cdr.detectChanges();
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

  openIngredientModal() {
    this.showIngredientModal = true;
    // Initialize selected quantities
    this.paginatedInventory.forEach(item => {
      if (!this.selectedIngredientQuantity[item.name]) {
        this.selectedIngredientQuantity[item.name] = item.quantity || 1;
      }
    });
  }

  closeIngredientModal() {
    this.showIngredientModal = false;
    this.selectedIngredientQuantity = {};
  }

  selectIngredient(item: InventoryItem) {
    const quantity = this.selectedIngredientQuantity[item.name] || item.quantity || 1;
    const quantityStr = quantity > 0 ? String(quantity) : '';
    
    // Add to ingredientList
    this.ingredientList.push({
      name: item.name,
      quantity: quantityStr
    });
    
    // Close modal after selection
    this.closeIngredientModal();
    this.cdr.detectChanges();
  }

  updateIngredientQuantity(itemName: string, quantity: number) {
    this.selectedIngredientQuantity[itemName] = Math.max(1, quantity);
  }
}

