import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { FoodService, Food } from '../../services/food.service';
import { BrowseFoodService, MarkedFood } from '../../services/browse-food.service';

interface Meal {
  id: string;
  name: string;
  image: string;
  description?: string;
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

@Component({
  selector: 'app-browse-recipes',
  standalone: true,
  templateUrl: './browse-recipes.component.html',
  styleUrls: ['./browse-recipes.component.css'],
  imports: [CommonModule, FormsModule, SidebarComponent]
})
export class BrowseRecipesComponent implements OnInit {
  selectedDate: string = '';
  selectedMealType: string = '';

  suggestedMeals: Meal[] = [
    { id: '1', name: 'Chicken Rice', image: 'assets/recipes/chicken-rice.jpg' },
    { id: '2', name: 'Chicken Salad', image: 'assets/recipes/chicken-salad.jpg' },
    { id: '3', name: 'Fried Rice', image: 'assets/recipes/fried-rice.jpg' }
  ];

  genericMeals: Meal[] = [
    { id: '4', name: 'Scrambled Eggs', image: 'assets/images/ge-food1.jpg', description: 'Egg 2, Onion 1, Salt, Oil 1, Carrot 1' },
    { id: '5', name: 'Potato & Veggie Hash', image: 'assets/images/ge-food2.jpg', description: 'Potato 2, Onion 1, Bell Pepper 1, Parsley 1, Oil 1, Salt 1' },
    { id: '6', name: 'Boiled Egg', image: 'assets/images/ge-food3.jpg', description: 'Egg 1, Salt, Water 1' },
    { id: '7', name: 'Toast', image: 'assets/images/ge-food4.jpg', description: 'Bread 1, Butter 1' },
    { id: '8', name: 'Vegetable Soup', image: 'assets/images/ge-food5.jpg', description: 'Onion 1, Carrot 1, Potato 1, Salt 1, Water 3' },
    { id: '9', name: 'Simple Salad', image: 'assets/images/ge-food6.jpg', description: 'Lettuce 1, Tomato 1, Cucumber 1, Olive Oil 1, Salt 1' },
    { id: '10', name: 'Mashed Potato', image: 'assets/images/ge-food7.jpg', description: 'Potato 2, Butter 1, Milk 1, Salt 1' },
    { id: '11', name: 'Fried Rice', image: 'assets/images/ge-food8.jpg', description: 'Rice 1, Egg 1, Carrot 1, Onion 1, Oil 1, Salt 1' },
    { id: '12', name: 'Cereal', image: 'assets/images/ge-food9.jpg', description: 'Cereal 1, Milk 1' },
    { id: '13', name: 'Omelet', image: 'assets/images/ge-food10.jpg', description: 'Egg 2, Onion 1, Tomato 1, Oil 1, Salt 1' }
  ];

  currentSuggestedIndex: number = 0;
  currentMoreIndex: number = 0;
  
  // Image error tracking
  imageErrors: Set<string> = new Set();

  searchTerm: string = '';
  selectedItemIndex: number = -1;
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
      
      // Restore carousel position if coming back from meal-detail
      const section = params['section'];
      const index = params['index'];
      if (section && index !== undefined) {
        const parsedIndex = parseInt(index, 10);
        if (section === 'suggested' && !isNaN(parsedIndex) && parsedIndex >= 0 && parsedIndex < this.suggestedMeals.length) {
          this.currentSuggestedIndex = parsedIndex;
        } else if (section === 'generic' && !isNaN(parsedIndex) && parsedIndex >= 0 && parsedIndex < this.genericMeals.length) {
          this.currentMoreIndex = parsedIndex;
        }
      }
    });
    
    // Load inventory from database
    this.loadInventory();
  }

  previousSuggested() {
    this.currentSuggestedIndex = (this.currentSuggestedIndex - 1 + this.suggestedMeals.length) % this.suggestedMeals.length;
  }

  nextSuggested() {
    this.currentSuggestedIndex = (this.currentSuggestedIndex + 1) % this.suggestedMeals.length;
  }

  previousMore() {
    this.currentMoreIndex = (this.currentMoreIndex - 1 + this.genericMeals.length) % this.genericMeals.length;
  }

  nextMore() {
    this.currentMoreIndex = (this.currentMoreIndex + 1) % this.genericMeals.length;
  }

  selectMeal(meal: Meal) {
    // Find which section the meal belongs to and its index
    let section: 'suggested' | 'generic' = 'suggested';
    let index = this.suggestedMeals.findIndex(m => m.id === meal.id);
    
    if (index === -1) {
      section = 'generic';
      index = this.genericMeals.findIndex(m => m.id === meal.id);
    }
    
    // Navigate to meal-detail page with meal ID and section/index info
    this.router.navigate(['/meal-detail', meal.id], {
      queryParams: { section: section, index: index }
    });
  }

  back() {
    this.router.navigate(['/planWeeklyMeal']);
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

    // Load only marked foods
    this.browseService.getMarkedFoods().subscribe({
      next: (markedFoods: MarkedFood[]) => {
        // Store raw marked foods for faster access
        this.rawMarkedFoods = markedFoods;
        
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

          const dbQty = markedFood.qty || 0;

          return {
            foodId: foodIdStr,
            name: markedFood.name,
            quantity: dbQty,
            category: markedFood.category || 'Other',
            marked: true,
            markedQuantity: dbQty,
            expiry: expiryStr,
            markedFoodIds: markedFood._id ? [markedFood._id] : []
          };
        });

        // Merge marked items with same foodId
        const markedItemsByFoodId = new Map<string, InventoryItem>();
        markedItems.forEach(item => {
          const foodId = item.foodId;
          if (!foodId) {
            return;
          }
          
          const existing = markedItemsByFoodId.get(foodId);
          if (existing) {
            const newQuantity = existing.quantity + item.quantity;
            const newMarkedQuantity = existing.markedQuantity + item.markedQuantity;
            
            existing.quantity = newQuantity;
            existing.markedQuantity = newMarkedQuantity;
            if (item.markedFoodIds && item.markedFoodIds.length > 0) {
              existing.markedFoodIds = (existing.markedFoodIds || []).concat(item.markedFoodIds);
            }
          } else {
            markedItemsByFoodId.set(foodId, { ...item });
          }
        });

        this.inventory = Array.from(markedItemsByFoodId.values());
        this.updateAvailableCategories();
        this.applyFilters();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading marked foods:', err);
        this.inventory = [];
        this.filteredInventory = [];
        this.availableCategories = [];
        this.applyFilters();
        this.cdr.detectChanges();
      }
    });
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

    // Apply category filter
    if (this.selectedCategories.size > 0) {
      filtered = filtered.filter(item => {
        if (!item.category) return false;
        const normalizedItemCategory = item.category.trim().toLowerCase();
        return Array.from(this.selectedCategories).some(selectedCat => 
          selectedCat.trim().toLowerCase() === normalizedItemCategory
        );
      });
    }

    // Apply expiry filter
    if (this.expiryFilterDays !== null && this.expiryFilterDays > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const filterDays = this.expiryFilterDays;
      
      filtered = filtered.filter(item => {
        if (!item.expiry) return false;
        
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
        
        return diffDays >= 0 && diffDays <= filterDays;
      });
    }

    // Apply search term filter
    if (this.searchTerm.trim()) {
      const searchTermLower = this.searchTerm.toLowerCase().trim();
      const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 0);
      
      filtered = filtered.filter(item => {
        const itemNameLower = item.name.toLowerCase();
        const itemCategoryLower = item.category.toLowerCase();
        
        return searchWords.every(word => {
          const wordPattern = new RegExp(`(^|\\s)${this.escapeRegex(word)}`, 'i');
          const nameMatch = wordPattern.test(itemNameLower) || itemNameLower === word;
          const categoryMatch = wordPattern.test(itemCategoryLower) || itemCategoryLower === word;
          return nameMatch || categoryMatch;
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
        categorySet.add(item.category.trim());
      }
    });
    this.availableCategories = Array.from(categorySet).sort((a, b) => 
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
    
    // Initialize: Select all categories by default if none are selected
    if (this.selectedCategories.size === 0 && this.availableCategories.length > 0) {
      this.availableCategories.forEach(cat => this.selectedCategories.add(cat));
    }
  }

  selectItem(index: number) {
    this.selectedItemIndex = index;
  }

  openRemoveModal(item: InventoryItem, event: Event) {
    event.stopPropagation();
    
    if (!item || !item.foodId) {
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
    setTimeout(() => {
      this.showSuccessMessage = false;
      this.successMessage = '';
    }, 3000);
  }

  updateLocalInventoryAfterRemove(item: InventoryItem, removeQty: number, processedMarkedFoods: MarkedFood[]) {
    if (processedMarkedFoods && processedMarkedFoods.length > 0) {
      processedMarkedFoods.forEach(mf => {
        const cachedIndex = this.rawMarkedFoods.findIndex(r => r._id === mf._id);
        if (cachedIndex > -1) {
          this.rawMarkedFoods.splice(cachedIndex, 1);
        }
      });
    }
    
    setTimeout(() => {
      this.loadInventory();
    }, 200);
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

    this.isRemoving = true;
    const item = this.removeItem;
    const removeQty = Number(this.removeQuantity);
    const remainingMarkedQty = item.markedQuantity - removeQty;

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user.id;

    if (!userId) {
      alert('User ID not found');
      this.isRemoving = false;
      return;
    }

    this.foodService.getFoods(userId).subscribe({
      next: (foods: any[]) => {
        let originalFood = foods.find(f => f._id === item.foodId);
        if (!originalFood) {
          originalFood = foods.find(f => String(f._id) === String(item.foodId));
        }
        if (!originalFood) {
          originalFood = foods.find(f => f.name === item.name && f.status === 'inventory');
        }
        
        if (!originalFood) {
          alert(`Original food item "${item.name}" not found in inventory.`);
          this.isRemoving = false;
          this.closeRemoveModal();
          return;
        }
        
        const actualFoodId = originalFood._id || item.foodId;
        const originalQtyBeforeUpdate = originalFood.qty;
        const newInventoryQty = originalQtyBeforeUpdate + removeQty;

        // Update original food quantity
        this.browseService.updateFoodQty(actualFoodId, newInventoryQty).subscribe({
          next: (updatedFood) => {
            // Now update or delete marked food(s)
            if (remainingMarkedQty <= 0) {
              // Remove all marked foods for this foodId
              if (item.markedFoodIds && item.markedFoodIds.length > 0) {
                const deletePromises = item.markedFoodIds.map(id => 
                  this.browseService.deleteMarkedFood(id).toPromise()
                );
                Promise.all(deletePromises).then(() => {
                  this.isRemoving = false;
                  this.closeRemoveModal();
                  this.updateLocalInventoryAfterRemove(item, removeQty, []);
                  this.showSuccessToast(`Removed ${removeQty} ${item.name}(s) successfully✅`);
                }).catch(err => {
                  console.error('❌ Error deleting marked foods:', err);
                  this.isRemoving = false;
                  this.loadInventory();
                  alert('Failed to remove marked foods❌');
                });
              } else {
                this.isRemoving = false;
                this.loadInventory();
                this.closeRemoveModal();
              }
            } else {
              if (item.markedFoodIds && item.markedFoodIds.length > 0) {
                const extractFoodId = (mf: MarkedFood): string => {
                  const foodIdValue = (mf as any).foodId;
                  if (typeof foodIdValue === 'string') {
                    return foodIdValue;
                  } else if (foodIdValue && typeof foodIdValue === 'object' && foodIdValue._id) {
                    return foodIdValue._id;
                  }
                  return String(foodIdValue || '');
                };

                const relevantMarkedFoods = this.rawMarkedFoods.filter(mf => {
                  const mfFoodId = extractFoodId(mf);
                  return String(mfFoodId) === String(item.foodId) && 
                         item.markedFoodIds?.includes(mf._id || '');
                });

                if (relevantMarkedFoods.length === 0) {
                  this.isRemoving = false;
                  this.loadInventory();
                  this.closeRemoveModal();
                  return;
                }

                let remainingToRemove = removeQty;
                let completedOperations = 0;
                let hasError = false;
                const totalMarkedFoods = relevantMarkedFoods.length;
                let operationsStarted = 0;

                const finishProcessing = () => {
                  this.isRemoving = false;
                  if (hasError) {
                    this.browseService.updateFoodQty(actualFoodId, originalQtyBeforeUpdate).subscribe({
                      next: () => {
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
                  
                  this.closeRemoveModal();
                  this.updateLocalInventoryAfterRemove(item, removeQty, relevantMarkedFoods);
                  this.showSuccessToast(`Removed ${removeQty} ${item.name}(s) successfully✅`);
                };

                const checkCompletion = () => {
                  if (completedOperations === operationsStarted && operationsStarted > 0) {
                    finishProcessing();
                  } else if (remainingToRemove <= 0 && operationsStarted === 0) {
                    finishProcessing();
                  }
                };

                const processNextMarkedFood = (index: number) => {
                  if (remainingToRemove <= 0) {
                    checkCompletion();
                    return;
                  }
                  
                  if (index >= totalMarkedFoods) {
                    checkCompletion();
                    return;
                  }

                  const markedFood = relevantMarkedFoods[index];
                  if (!markedFood._id) {
                    processNextMarkedFood(index + 1);
                    return;
                  }

                  const thisMarkedQty = markedFood.qty;
                  const qtyToRemoveFromThis = Math.min(remainingToRemove, thisMarkedQty);
                  const newQty = thisMarkedQty - qtyToRemoveFromThis;
                  
                  operationsStarted++;
                  remainingToRemove -= qtyToRemoveFromThis;

                  if (newQty <= 0) {
                    this.browseService.deleteMarkedFood(markedFood._id).subscribe({
                      next: () => {
                        completedOperations++;
                        processNextMarkedFood(index + 1);
                        checkCompletion();
                      },
                      error: (err) => {
                        console.error('❌ Error deleting marked food:', err);
                        hasError = true;
                        completedOperations++;
                        processNextMarkedFood(index + 1);
                        checkCompletion();
                      }
                    });
                  } else {
                    this.browseService.updateMarkedFoodQty(markedFood._id, newQty).subscribe({
                      next: () => {
                        completedOperations++;
                        processNextMarkedFood(index + 1);
                        checkCompletion();
                      },
                      error: (err) => {
                        console.error('❌ Error updating marked food:', err);
                        hasError = true;
                        completedOperations++;
                        processNextMarkedFood(index + 1);
                        checkCompletion();
                      }
                    });
                  }
                };

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

  getCategoryIcon(category: string): string {
    // Normalize category name for matching (case-insensitive, handle singular/plural)
    const normalized = category.trim().toLowerCase();
    
    const iconMap: { [key: string]: string } = {
      'fruit': '🍎',
      'fruits': '🍎',
      'vegetable': '🥬',
      'vegetables': '🥬',
      'meat': '🥩',
      'dairy': '🥛',
      'grain': '🌾',
      'grains': '🌾',
      'other': '📦'
    };
    
    // Check exact match first
    if (iconMap[normalized]) {
      return iconMap[normalized];
    }
    
    // Check if category contains any of the keywords
    for (const [key, icon] of Object.entries(iconMap)) {
      if (normalized.includes(key)) {
        return icon;
      }
    }
    
    return '📦';
  }

  onImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    const imageSrc = img.src;
    
    // Prevent infinite loop by checking if already set to placeholder or already handled
    if (imageSrc && !imageSrc.includes('placeholder') && !this.imageErrors.has(imageSrc)) {
      this.imageErrors.add(imageSrc);
      img.src = 'assets/placeholder-recipe.jpg';
    } else if (imageSrc && imageSrc.includes('placeholder')) {
      // If placeholder also fails, hide the image
      img.style.display = 'none';
    }
  }

  onImageLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'block';
    // Remove from error set if it was there
    this.imageErrors.delete(img.src);
  }
}

