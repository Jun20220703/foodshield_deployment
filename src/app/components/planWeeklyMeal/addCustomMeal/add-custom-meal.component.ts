import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { firstValueFrom } from 'rxjs';
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
  ingredientList: Array<{ name: string; quantity: string; inventoryType?: 'marked' | 'non-marked'; maxQuantity?: number }> = [];
  originalIngredientList: Array<{ name: string; quantity: string; inventoryType?: 'marked' | 'non-marked'; maxQuantity?: number }> = []; // Store original ingredients for edit mode
  
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
      }
      // Not in edit mode: ingredientList starts empty, user clicks button to add
    });
    
    // CRITICAL: Ensure filter drawer is closed by default
    this.showFilter = false;
    
    // Initialize with empty arrays to prevent undefined errors
    this.inventory = [];
    this.filteredInventory = [];
    this.paginatedInventory = [];
    
    // ingredientList starts empty - user will add ingredients via button
    
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
        
        // Store original ingredients for comparison during edit
        this.originalIngredientList = JSON.parse(JSON.stringify(this.ingredientList));
        console.log('📋 Original ingredients stored:', this.originalIngredientList);
        
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Error loading existing meal:', err);
        alert('Failed to load meal data. Please try again.');
      }
    });
  }

  // Parse ingredients string into ingredientList
  // Format: "IngredientName Quantity [marked|non-marked]"
  parseIngredientsToList(ingredientsStr: string) {
    this.ingredientList = [];
    
    if (!ingredientsStr || !ingredientsStr.trim()) {
      // If empty, keep list empty
      return;
    }
    
    // Split by newline
    const lines = ingredientsStr.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) {
      // If no valid lines, keep list empty
      return;
    }
    
    // Parse each line: "Ingredient Name 200g [marked]" or "Ingredient Name [non-marked]"
    lines.forEach(line => {
      // Extract inventory type: [marked] or [non-marked]
      const typeMatch = line.match(/\s+\[(marked|non-marked)\]\s*$/);
      const inventoryType = typeMatch ? (typeMatch[1] as 'marked' | 'non-marked') : 'marked';
      const lineWithoutType = typeMatch ? line.substring(0, typeMatch.index).trim() : line;
      
      // Try to extract quantity (numbers followed by units like g, kg, ml, l, tbsp, tsp, cup, cups, oz, lb)
      const quantityMatch = lineWithoutType.match(/\s+(\d+(?:\.\d+)?)\s*(g|kg|ml|l|tbsp|tsp|cup|cups|oz|lb|개|조각|컵|스푼|작은술|큰술)\s*$/i);
      
      if (quantityMatch) {
        const quantity = quantityMatch[1] + quantityMatch[2];
        const name = lineWithoutType.substring(0, quantityMatch.index).trim();
        this.ingredientList.push({ name, quantity, inventoryType });
      } else {
        // No quantity found, check if there's a number at the end
        const numberMatch = lineWithoutType.match(/\s+(\d+(?:\.\d+)?)\s*$/);
        if (numberMatch) {
          const quantity = numberMatch[1];
          const name = lineWithoutType.substring(0, numberMatch.index).trim();
          this.ingredientList.push({ name, quantity, inventoryType });
        } else {
          // Just ingredient name, no quantity
          this.ingredientList.push({ name: lineWithoutType, quantity: '', inventoryType });
        }
      }
    });
    
    // If no ingredients parsed, keep list empty (no need to add empty row)
  }

  // Convert ingredientList to ingredients string for database
  // Format: "IngredientName Quantity [marked|non-marked]"
  convertIngredientsListToString(): string {
    return this.ingredientList
      .filter(ing => ing.name.trim().length > 0)
      .map(ing => {
        const name = ing.name.trim();
        const qty = ing.quantity.trim();
        const type = ing.inventoryType || 'marked'; // Default to marked if not specified
        const baseStr = qty ? `${name} ${qty}` : name;
        return `${baseStr} [${type}]`;
      })
      .join('\n');
  }

  // Add new ingredient row
  addIngredient() {
    this.ingredientList.push({ name: '', quantity: '' });
  }

  // Remove ingredient row
  removeIngredient(index: number) {
    this.ingredientList.splice(index, 1);
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
          
          // Calculate difference between original and new ingredients
          // Restore original quantities first, then reduce new quantities
          this.adjustIngredientQuantitiesForEdit().then(() => {
            alert('Custom meal updated successfully!');
            this.router.navigate(['/planWeeklyMeal']);
          }).catch((err: any) => {
            console.error('❌ Error adjusting ingredient quantities:', err);
            alert('Meal updated but failed to adjust ingredient quantities. Please check your inventory.');
            this.router.navigate(['/planWeeklyMeal']);
          });
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
          
          // Reduce ingredient quantities from marked/non-marked foods
          this.reduceIngredientQuantities(this.ingredientList).then(() => {
            alert('Custom meal created successfully!');
            // Navigate back to planWeeklyMeal page
            this.router.navigate(['/planWeeklyMeal']);
          }).catch((err: any) => {
            console.error('❌ Error reducing ingredient quantities:', err);
            alert('Meal created but failed to update ingredient quantities. Please check your inventory.');
    this.router.navigate(['/planWeeklyMeal']);
          });
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
    // Ensure quantity doesn't exceed available quantity
    const maxQty = item.quantity || 0;
    const finalQuantity = Math.min(quantity, maxQty);
    const quantityStr = finalQuantity > 0 ? String(finalQuantity) : '';
    
    // Add to ingredientList at the end (bottom of the list)
    const newIngredient = {
      name: item.name,
      quantity: quantityStr,
      inventoryType: this.inventoryType, // Store the inventory type when selecting
      maxQuantity: maxQty // Store max quantity from database
    };
    
    console.log('🔍 Adding ingredient:', newIngredient);
    console.log('🔍 Selected item:', item);
    console.log('🔍 Current inventoryType:', this.inventoryType);
    console.log('🔍 Max quantity from DB:', maxQty);
    console.log('🔍 Current ingredientList before add:', this.ingredientList);
    
    // Add to the end of the list (bottom)
    this.ingredientList.push(newIngredient);
    
    console.log('🔍 Current ingredientList after add:', this.ingredientList);
    
    // Close modal after selection
    this.closeIngredientModal();
    this.cdr.detectChanges();
  }
  
  // Validate and update ingredient quantity
  onIngredientQuantityChange(ingredient: { name: string; quantity: string; maxQuantity?: number }, index: number, event?: any) {
    if (!ingredient.maxQuantity) {
      return; // No max quantity set, skip validation
    }
    
    // Get the input value directly from event if available
    let inputValue = ingredient.quantity;
    if (event && event.target) {
      inputValue = event.target.value;
    }
    
    // Extract numeric value from quantity string
    const quantityStr = inputValue.trim();
    const quantityMatch = quantityStr.match(/^(\d+(?:\.\d+)?)/);
    
    if (!quantityMatch) {
      // Invalid format, reset to 1
      ingredient.quantity = '1';
      if (event && event.target) {
        event.target.value = '1';
      }
      return;
    }
    
    const enteredQty = parseFloat(quantityMatch[1]);
    if (isNaN(enteredQty) || enteredQty <= 0) {
      ingredient.quantity = '1';
      if (event && event.target) {
        event.target.value = '1';
      }
      return;
    }
    
    // Ensure quantity doesn't exceed max
    if (enteredQty > ingredient.maxQuantity) {
      alert(`Maximum quantity available is ${ingredient.maxQuantity}. Please enter a value less than or equal to ${ingredient.maxQuantity}.`);
      ingredient.quantity = String(ingredient.maxQuantity);
      if (event && event.target) {
        event.target.value = String(ingredient.maxQuantity);
      }
      this.cdr.detectChanges();
    } else {
      // Valid quantity, update the ingredient
      ingredient.quantity = quantityStr;
    }
  }
  
  // Validate on input event (real-time validation)
  onIngredientQuantityInput(ingredient: { name: string; quantity: string; maxQuantity?: number }, index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    
    if (!ingredient.maxQuantity) {
      return;
    }
    
    // Extract numeric value
    const quantityMatch = value.match(/^(\d+(?:\.\d+)?)/);
    if (!quantityMatch) {
      return; // Let user type, will validate on blur
    }
    
    const enteredQty = parseFloat(quantityMatch[1]);
    if (!isNaN(enteredQty) && enteredQty > ingredient.maxQuantity) {
      // Prevent entering values above max
      input.value = String(ingredient.maxQuantity);
      ingredient.quantity = String(ingredient.maxQuantity);
      this.cdr.detectChanges();
    }
  }

  updateIngredientQuantity(itemName: string, quantity: number) {
    this.selectedIngredientQuantity[itemName] = Math.max(1, quantity);
  }

  // Reduce ingredient quantities from marked/non-marked foods
  async reduceIngredientQuantities(ingredients: Array<{ name: string; quantity: string; inventoryType?: 'marked' | 'non-marked' }>): Promise<void> {
    console.log('🔄 Starting reduceIngredientQuantities with ingredients:', ingredients);
    
    const userId = JSON.parse(localStorage.getItem('user') || '{}').id;
    if (!userId) {
      throw new Error('User ID not found');
    }

    // Get all marked foods and non-marked foods
    const markedFoodsPromise = firstValueFrom(this.browseService.getMarkedFoods());
    const allFoodsPromise = firstValueFrom(this.browseService.getFoods());

    const [markedFoods, allFoods] = await Promise.all([markedFoodsPromise, allFoodsPromise]);

    if (!markedFoods || !allFoods) {
      throw new Error('Failed to load inventory');
    }

    console.log('📦 Loaded marked foods:', markedFoods.length);
    console.log('📦 Loaded non-marked foods:', allFoods.length);

    // Process each ingredient
    const updatePromises: Promise<any>[] = [];

    for (const ingredient of ingredients) {
      console.log(`🔍 Processing ingredient:`, ingredient);
      
      if (!ingredient.name.trim() || !ingredient.quantity.trim()) {
        console.warn(`⚠️ Skipping ingredient with empty name or quantity:`, ingredient);
        continue;
      }

      // Extract numeric value from quantity string (e.g., "200g" -> 200, "1.5kg" -> 1.5)
      const quantityStr = ingredient.quantity.trim();
      const quantityMatch = quantityStr.match(/^(\d+(?:\.\d+)?)/);
      if (!quantityMatch) {
        console.warn(`⚠️ Could not parse quantity from: "${quantityStr}"`);
        continue;
      }
      const quantityToReduce = parseFloat(quantityMatch[1]);
      if (isNaN(quantityToReduce) || quantityToReduce <= 0) {
        console.warn(`⚠️ Invalid quantity: ${quantityToReduce}`);
        continue;
      }

      const inventoryType = ingredient.inventoryType || 'marked';
      const ingredientNameNormalized = ingredient.name.trim().toLowerCase();
      
      console.log(`📋 Processing: "${ingredient.name}" (normalized: "${ingredientNameNormalized}"), quantity: ${quantityToReduce}, type: ${inventoryType}`);

      if (inventoryType === 'marked') {
        // Find matching marked food - normalize both names for comparison
        const markedFood = markedFoods.find(mf => {
          const foodNameNormalized = (mf.name || '').toLowerCase().trim();
          return foodNameNormalized === ingredientNameNormalized;
        });
        
        console.log(`🔍 Looking for marked food "${ingredient.name}" (normalized: "${ingredientNameNormalized}"):`, markedFood);
        console.log(`🔍 Available marked foods:`, markedFoods.map(mf => ({ 
          name: mf.name, 
          normalized: (mf.name || '').toLowerCase().trim(),
          qty: mf.qty 
        })));
        
        if (markedFood && markedFood._id) {
          const newQty = Math.max(0, (markedFood.qty || 0) - quantityToReduce);
          console.log(`📉 Reducing marked food "${ingredient.name}": ${markedFood.qty} -> ${newQty}`);
          
          if (newQty === 0) {
            // Delete if quantity becomes 0
            updatePromises.push(
              firstValueFrom(this.browseService.deleteMarkedFood(markedFood._id))
                .then(() => console.log(`✅ Successfully deleted marked food "${ingredient.name}" (qty became 0)`))
                .catch((err: any) => {
                  console.error(`❌ Failed to delete marked food "${ingredient.name}":`, err);
                  throw err;
                })
            );
          } else {
            updatePromises.push(
              firstValueFrom(this.browseService.updateMarkedFoodQty(markedFood._id, newQty))
                .then(() => console.log(`✅ Successfully reduced marked food "${ingredient.name}"`))
                .catch((err: any) => {
                  console.error(`❌ Failed to reduce marked food "${ingredient.name}":`, err);
                  throw err;
                })
            );
          }
        } else {
          console.warn(`⚠️ Marked food not found: ${ingredient.name}`);
          console.warn(`⚠️ Available marked foods:`, markedFoods.map(mf => mf.name));
        }
      } else {
        // Find matching non-marked food (current inventory) - normalize both names for comparison
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
          const newQty = Math.max(0, (food.qty || 0) - quantityToReduce);
          console.log(`📉 Reducing non-marked food "${ingredient.name}": ${food.qty} -> ${newQty}`);
          updatePromises.push(
            firstValueFrom(this.browseService.updateFoodQty(food._id, newQty))
              .then(() => console.log(`✅ Successfully reduced non-marked food "${ingredient.name}"`))
              .catch((err: any) => {
                console.error(`❌ Failed to reduce non-marked food "${ingredient.name}":`, err);
                throw err;
              })
          );
        } else {
          console.warn(`⚠️ Non-marked food not found: ${ingredient.name}`);
          console.warn(`⚠️ Available non-marked foods:`, allFoods.map(f => f.name));
        }
      }
    }

    // Wait for all updates to complete
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      console.log('✅ All ingredient quantities reduced successfully');
    } else {
      console.warn('⚠️ No update promises to execute - no ingredients matched');
      throw new Error('No ingredients were successfully processed for quantity reduction');
    }
  }

  // Adjust ingredient quantities for edit mode
  // Restore original quantities first, then reduce new quantities
  async adjustIngredientQuantitiesForEdit(): Promise<void> {
    console.log('🔄 Starting adjustIngredientQuantitiesForEdit');
    console.log('📋 Original ingredients:', this.originalIngredientList);
    console.log('📋 New ingredients:', this.ingredientList);
    
    // Step 1: Restore original quantities (add them back)
    if (this.originalIngredientList.length > 0) {
      console.log('📈 Step 1: Restoring original quantities...');
      await this.restoreIngredientQuantities(this.originalIngredientList);
    }
    
    // Step 2: Reduce new quantities (subtract new amounts)
    if (this.ingredientList.length > 0) {
      console.log('📉 Step 2: Reducing new quantities...');
      await this.reduceIngredientQuantities(this.ingredientList);
    }
    
    console.log('✅ Ingredient quantities adjusted successfully for edit');
  }

  // Restore ingredient quantities (used for edit mode)
  async restoreIngredientQuantities(ingredients: Array<{ name: string; quantity: string; inventoryType?: 'marked' | 'non-marked' }>): Promise<void> {
    console.log('🔄 Starting restoreIngredientQuantities with ingredients:', ingredients);
    
    const userId = JSON.parse(localStorage.getItem('user') || '{}').id;
    if (!userId) {
      throw new Error('User ID not found');
    }

    // Get all marked foods and non-marked foods
    const markedFoodsPromise = firstValueFrom(this.browseService.getMarkedFoods());
    const allFoodsPromise = firstValueFrom(this.browseService.getFoods());

    const [markedFoods, allFoods] = await Promise.all([markedFoodsPromise, allFoodsPromise]);

    if (!markedFoods || !allFoods) {
      throw new Error('Failed to load inventory');
    }

    console.log('📦 Loaded marked foods:', markedFoods.length);
    console.log('📦 Loaded non-marked foods:', allFoods.length);

    // Process each ingredient
    const updatePromises: Promise<any>[] = [];

    for (const ingredient of ingredients) {
      console.log(`🔍 Processing ingredient for restoration:`, ingredient);
      
      if (!ingredient.name.trim() || !ingredient.quantity.trim()) {
        console.warn(`⚠️ Skipping ingredient with empty name or quantity:`, ingredient);
        continue;
      }

      // Extract numeric value from quantity string
      const quantityStr = ingredient.quantity.trim();
      const quantityMatch = quantityStr.match(/^(\d+(?:\.\d+)?)/);
      if (!quantityMatch) {
        console.warn(`⚠️ Could not parse quantity from: "${quantityStr}"`);
        continue;
      }
      const quantityToRestore = parseFloat(quantityMatch[1]);
      if (isNaN(quantityToRestore) || quantityToRestore <= 0) {
        console.warn(`⚠️ Invalid quantity: ${quantityToRestore}`);
        continue;
      }

      const inventoryType = ingredient.inventoryType || 'marked';
      const ingredientNameNormalized = ingredient.name.trim().toLowerCase();
      
      console.log(`📋 Restoring: "${ingredient.name}" (normalized: "${ingredientNameNormalized}"), quantity: ${quantityToRestore}, type: ${inventoryType}`);

      if (inventoryType === 'marked') {
        // Find matching marked food
        const markedFood = markedFoods.find(mf => {
          const foodNameNormalized = (mf.name || '').toLowerCase().trim();
          return foodNameNormalized === ingredientNameNormalized;
        });
        
        console.log(`🔍 Looking for marked food "${ingredient.name}" (normalized: "${ingredientNameNormalized}"):`, markedFood);
        
        if (markedFood && markedFood._id) {
          const newQty = (markedFood.qty || 0) + quantityToRestore;
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
          // If marked food doesn't exist, try to find it in non-marked foods and create a marked food entry
          console.log(`🔄 Trying to find "${ingredient.name}" in non-marked foods to create marked food entry...`);
          const nonMarkedFood = allFoods.find(f => {
            const foodNameNormalized = (f.name || '').toLowerCase().trim();
            return foodNameNormalized === ingredientNameNormalized;
          });
          
          if (nonMarkedFood && nonMarkedFood._id) {
            console.log(`✅ Found in non-marked foods, creating marked food entry:`, nonMarkedFood);
            let expiryDate = '';
            if (nonMarkedFood.expiry) {
              if (typeof nonMarkedFood.expiry === 'string') {
                expiryDate = nonMarkedFood.expiry;
              } else {
                expiryDate = new Date(nonMarkedFood.expiry).toISOString();
              }
            } else {
              const defaultExpiry = new Date();
              defaultExpiry.setDate(defaultExpiry.getDate() + 7);
              expiryDate = defaultExpiry.toISOString();
            }
            
            const newMarkedFoodData = {
              foodId: nonMarkedFood._id,
              name: nonMarkedFood.name,
              qty: quantityToRestore,
              category: nonMarkedFood.category || 'Other',
              storage: nonMarkedFood.storage || 'Fridge',
              expiry: expiryDate,
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
            console.warn(`⚠️ Marked food not found and cannot create from non-marked: ${ingredient.name}`);
          }
        }
      } else {
        // Find matching non-marked food
        const food = allFoods.find(f => {
          const foodNameNormalized = (f.name || '').toLowerCase().trim();
          return foodNameNormalized === ingredientNameNormalized;
        });
        
        console.log(`🔍 Looking for non-marked food "${ingredient.name}" (normalized: "${ingredientNameNormalized}"):`, food);
        
        if (food && food._id) {
          const newQty = (food.qty || 0) + quantityToRestore;
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
          console.warn(`⚠️ Non-marked food not found for restoration: ${ingredient.name}`);
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
}

