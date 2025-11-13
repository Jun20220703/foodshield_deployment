import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { FoodService } from '../../services/food.service';
import { BrowseFoodService, MarkedFood, Food } from '../../services/browse-food.service';

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

  // All possible suggested meals with their ingredients
  allSuggestedMeals: Meal[] = [
    { id: '1', name: 'Chicken Rice', image: 'assets/images/su-food1.jpg', description: 'Chicken 1, Rice 1, Garlic 1, Soy Sauce 1, Green Onion 1, Cucumber 1' },
    { id: '2', name: 'Chicken Salad', image: 'assets/images/su-food2.jpg', description: 'Lettuce 3, Tomato 1, Cucumber 1, Chicken 1, Dressing 1' },
    { id: '3', name: 'Spaghetti', image: 'assets/images/su-food3.jpg', description: 'Spaghetti Noodles 1, Garlic 2, Olive Oil 1, Salt 1, Black Pepper 1' },
    { id: '4', name: 'Kimchi Fried Rice', image: 'assets/images/su-food4.jpg', description: 'Rice 1, Kimchi 2, Egg 1, Green Onion 1, Soy Sauce 1' },
    { id: '5', name: 'Burger', image: 'assets/images/su-food5.jpg', description: 'Burger Bun 1, Meat Patty 1, Lettuce 1, Tomato 1, Cheese 1' },
    { id: '6', name: 'Tuna Mayo Rice', image: 'assets/images/su-food6.jpg', description: 'Rice 1, Tuna Can 1, Mayonnaise 1, Soy sauce 1, Seaweed Flakes 1' },
    { id: '7', name: 'Tteokbokki', image: 'assets/images/su-food7.jpg', description: 'Rice Cake 1, Gochujang 1, Sugar 1, Green Onion 1, Fish Cake 1' },
    { id: '8', name: 'Tomato Pasta', image: 'assets/images/su-food8.jpg', description: 'Pasta Noodles 1, Tomato Sauce 2, Onion 1, Garlic 2, Olive Oil 2' },
    { id: '9', name: 'Omurice', image: 'assets/images/su-food9.jpg', description: 'Rice 1, Egg 2, Onion 1, Ketchup 1, Ham 1' },
    { id: '10', name: 'Pancake', image: 'assets/images/su-food10.jpg', description: 'Pancake Mix 2, Egg 1, Milk 1, Butter 1, Sugar 1' },
    { id: '11', name: 'Carbonara Pasta', image: 'assets/images/su-food11.jpg', description: 'Pasta Noodles 1, Egg 1, Bacon 1, Parmesan Cheese 1, Black Pepper 1' },
    { id: '12', name: 'Cheese Sandwich', image: 'assets/images/su-food12.jpg', description: 'Bread 2, Ham 1, Cheese 1, Lettuce 1, Tomato 1' },
    { id: '13', name: 'Teriyaki Chicken', image: 'assets/images/su-food13.jpg', description: 'Chicken 1, Soy Sauce 2, Sugar 1, Garlic 1, Green Onion 1' },
    { id: '14', name: 'Japanese Curry Rice', image: 'assets/images/su-food14.jpg', description: 'Rice 1, Curry Roux 1, Potato 1, Carrot 1, Onion 1' },
    { id: '15', name: 'Shrimp Fried Rice', image: 'assets/images/su-food15.jpg', description: 'Rice 1, Shrimp 1, Egg 1, Garlic 1, Soy Sauce 1' }
  ];

  suggestedMeals: Meal[] = [];

  genericMeals: Meal[] = [
    { id: '16', name: 'Scrambled Eggs', image: 'assets/images/ge-food1.jpg', description: 'Egg 2, Onion 1, Salt, Oil 1, Carrot 1' },
    { id: '17', name: 'Potato & Veggie Hash', image: 'assets/images/ge-food2.jpg', description: 'Potato 2, Onion 1, Bell Pepper 1, Parsley 1, Oil 1, Salt 1' },
    { id: '18', name: 'Boiled Egg', image: 'assets/images/ge-food3.jpg', description: 'Egg 1, Salt, Water 1' },
    { id: '19', name: 'Toast', image: 'assets/images/ge-food4.jpg', description: 'Bread 1, Butter 1' },
    { id: '20', name: 'Vegetable Soup', image: 'assets/images/ge-food5.jpg', description: 'Onion 1, Carrot 1, Potato 1, Salt 1, Water 3' },
    { id: '21', name: 'Simple Salad', image: 'assets/images/ge-food6.jpg', description: 'Lettuce 1, Tomato 1, Cucumber 1, Olive Oil 1, Salt 1' },
    { id: '22', name: 'Mashed Potato', image: 'assets/images/ge-food7.jpg', description: 'Potato 2, Butter 1, Milk 1, Salt 1' },
    { id: '23', name: 'Fried Rice', image: 'assets/images/ge-food8.jpg', description: 'Rice 1, Egg 1, Carrot 1, Onion 1, Oil 1, Salt 1' },
    { id: '24', name: 'Cereal', image: 'assets/images/ge-food9.jpg', description: 'Cereal 1, Milk 1' },
    { id: '25', name: 'Omelet', image: 'assets/images/ge-food10.jpg', description: 'Egg 2, Onion 1, Tomato 1, Oil 1, Salt 1' }
  ];

  currentSuggestedIndex: number = 0;
  currentMoreIndex: number = 0;
  
  // Image error tracking
  imageErrors: Set<string> = new Set();

  searchTerm: string = '';
  selectedItemIndex: number = -1;
  inventory: InventoryItem[] = [];
  filteredInventory: InventoryItem[] = [];
  nonMarkedFoods: InventoryItem[] = []; // Store non-marked foods for expiry checking
  inventoryType: 'marked' | 'non-marked' = 'marked';
  
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
    
    // Get date and mealType from query params (if coming from planWeeklyMeal)
    this.route.queryParams.subscribe(queryParams => {
      const date = queryParams['date'];
      const mealType = queryParams['mealType'];
      
      // Navigate to meal-detail page with meal ID, section/index, and date/mealType info
      const navQueryParams: any = { section: section, index: index };
      if (date && mealType) {
        navQueryParams['date'] = date;
        navQueryParams['mealType'] = mealType;
      }
      
      this.router.navigate(['/meal-detail', meal.id], {
        queryParams: navQueryParams
      });
    }).unsubscribe();
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

    // Load marked or non-marked foods based on inventoryType
    if (this.inventoryType === 'marked') {
      // Load marked foods
      this.loadMarkedFoods();
    } else {
      // Load non-marked foods
      this.loadNonMarkedFoods();
    }
  }

  loadMarkedFoods() {
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
        
        // Sort inventory alphabetically by name (same as planWeeklyMeal)
        this.inventory.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
        
        // Load non-marked foods for expiry checking (only if inventoryType is 'marked')
        if (this.inventoryType === 'marked') {
          this.loadNonMarkedFoods();
        }
        
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

  loadNonMarkedFoods() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userId = user.id;

    if (!userId) {
      return;
    }

    this.browseService.getFoods().subscribe({
      next: (allFoods: Food[]) => {
        const inventoryItems = allFoods
          .filter((food: Food) => {
            return food.owner === userId && (!food.status || food.status === 'inventory');
          })
          .map((food: Food) => {
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
        
        // If inventoryType is 'non-marked', set inventory to non-marked foods
        if (this.inventoryType === 'non-marked') {
          this.inventory = inventoryItems;
          // Sort inventory alphabetically by name (same as planWeeklyMeal)
          this.inventory.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
          this.updateAvailableCategories();
          this.applyFilters();
          this.cdr.detectChanges();
        } else {
          // Store for expiry checking only
          this.nonMarkedFoods = inventoryItems;
        }
        
        // Filter suggested meals after loading both marked and non-marked foods
        this.filterSuggestedMeals();
      },
      error: (err) => {
        console.error('❌ Error loading non-marked foods:', err);
        this.nonMarkedFoods = [];
        // Still try to filter with what we have
        this.filterSuggestedMeals();
      }
    });
  }

  onInventoryTypeChange() {
    // Reset filters and reload inventory
    this.searchTerm = '';
    this.selectedCategories.clear();
    this.expiryFilterDays = null;
    this.currentPage = 1;
    this.loadInventory();
  }

  getDaysUntilExpiry(expiry: string): number {
    if (!expiry) return 999;
    
    try {
      const expiryParts = expiry.split('/');
      if (expiryParts.length !== 3) return 999;
      
      const expiryDate = new Date(
        parseInt(expiryParts[2]), 
        parseInt(expiryParts[1]) - 1, 
        parseInt(expiryParts[0])
      );
      expiryDate.setHours(0, 0, 0, 0);
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays;
    } catch (error) {
      return 999;
    }
  }

  parseIngredients(description: string): { name: string; quantity: number }[] {
    if (!description) return [];
    
    // Split by comma and extract ingredient names with quantities
    return description.split(',').map(ing => {
      const trimmed = ing.trim();
      // Extract quantity (number at the start or end)
      const quantityMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s+|\s+(\d+(?:\.\d+)?)$/);
      let quantity = 1; // Default quantity is 1
      
      if (quantityMatch) {
        quantity = parseFloat(quantityMatch[1] || quantityMatch[2] || '1');
      }
      
      // Extract ingredient name (remove quantity numbers)
      const name = trimmed.replace(/^\d+(?:\.\d+)?\s+/, '').replace(/\s+\d+(?:\.\d+)?$/, '').trim();
      
      return { name, quantity };
    }).filter(ing => ing.name.length > 0);
  }

  normalizeIngredientName(name: string): string {
    // Normalize ingredient names for comparison (lowercase, remove extra spaces, remove special characters)
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  // Check if two ingredient names match (case-insensitive, flexible matching)
  ingredientMatches(ingredient1: string, ingredient2: string): boolean {
    const normalized1 = this.normalizeIngredientName(ingredient1);
    const normalized2 = this.normalizeIngredientName(ingredient2);
    
    // Exact match
    if (normalized1 === normalized2) return true;
    
    // One contains the other (for partial matches like "Soy Sauce" vs "Soy")
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      // But avoid false positives (e.g., "Egg" matching "Eggplant")
      // Check if the shorter string is a complete word in the longer string
      const shorter = normalized1.length < normalized2.length ? normalized1 : normalized2;
      const longer = normalized1.length >= normalized2.length ? normalized1 : normalized2;
      
      // Check if shorter is a complete word (surrounded by spaces or at start/end)
      const wordBoundaryRegex = new RegExp(`(^|\\s)${shorter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i');
      if (wordBoundaryRegex.test(longer)) {
        return true;
      }
    }
    
    return false;
  }

  filterSuggestedMeals() {
    const allFoods = [...this.inventory, ...this.nonMarkedFoods];
    
    console.log('🔍 Filtering suggested meals...');
    console.log('📦 Marked foods:', this.inventory.map(f => f.name));
    console.log('📦 Non-marked foods:', this.nonMarkedFoods.map(f => f.name));
    
    // Create a map of food names to their total quantities (marked + non-marked)
    const foodQuantities = new Map<string, number>();
    allFoods.forEach(food => {
      const normalizedName = this.normalizeIngredientName(food.name);
      const currentQty = foodQuantities.get(normalizedName) || 0;
      foodQuantities.set(normalizedName, currentQty + food.quantity);
    });

    // Create sets for quick lookup
    const markedFoodNames = new Set(this.inventory.map(f => this.normalizeIngredientName(f.name)));
    const expiringFoodNames = new Set(
      allFoods
        .filter(f => this.getDaysUntilExpiry(f.expiry) <= 7)
        .map(f => this.normalizeIngredientName(f.name))
    );
    
    console.log('📋 Marked food names (normalized):', Array.from(markedFoodNames));
    console.log('📋 Food quantities:', Array.from(foodQuantities.entries()));

    this.suggestedMeals = this.allSuggestedMeals.filter(meal => {
      if (!meal.description) return false;
      
      const ingredients = this.parseIngredients(meal.description);
      if (ingredients.length === 0) return false;

      console.log(`\n🍽️ Checking meal: ${meal.name}`);
      console.log(`   Ingredients:`, ingredients);

      // Count how many ingredients match marked foods with sufficient quantity
      let matchedCount = 0;
      let hasExpiringIngredient = false;
      let allIngredientsHaveSufficientQuantity = true;

      ingredients.forEach(ingredient => {
        const normalizedIngredientName = this.normalizeIngredientName(ingredient.name);
        let foundMatch = false;
        let hasSufficientQuantity = false;

        // Check if ingredient matches any marked food (case-insensitive matching)
        for (const markedFoodName of markedFoodNames) {
          if (this.ingredientMatches(ingredient.name, markedFoodName)) {
            foundMatch = true;
            // Check if we have sufficient quantity
            const availableQty = foodQuantities.get(markedFoodName) || 0;
            console.log(`     ✅ Matched "${ingredient.name}" with marked food "${markedFoodName}" (available: ${availableQty}, needed: ${ingredient.quantity})`);
            if (availableQty >= ingredient.quantity) {
              hasSufficientQuantity = true;
              matchedCount++;
              console.log(`        ✓ Sufficient quantity`);
            } else {
              console.log(`        ✗ Insufficient quantity`);
            }
            break;
          }
        }

        // If not found in marked foods, check all foods (including non-marked) for quantity
        if (!foundMatch) {
          for (const [foodName, availableQty] of foodQuantities.entries()) {
            if (this.ingredientMatches(ingredient.name, foodName)) {
              foundMatch = true;
              const isMarked = markedFoodNames.has(foodName);
              console.log(`     ✅ Matched "${ingredient.name}" with food "${foodName}" (marked: ${isMarked}, available: ${availableQty}, needed: ${ingredient.quantity})`);
              if (availableQty >= ingredient.quantity) {
                hasSufficientQuantity = true;
                // If it's in marked foods, count it
                if (isMarked) {
                  matchedCount++;
                  console.log(`        ✓ Sufficient quantity and marked`);
                } else {
                  console.log(`        ✓ Sufficient quantity but not marked`);
                }
              } else {
                console.log(`        ✗ Insufficient quantity`);
              }
              break;
            }
          }
        }
        
        // If still no match, try more flexible matching
        if (!foundMatch) {
          for (const [foodName, availableQty] of foodQuantities.entries()) {
            const normalizedFoodName = this.normalizeIngredientName(foodName);
            // Try partial matching
            if (normalizedFoodName.includes(normalizedIngredientName) || normalizedIngredientName.includes(normalizedFoodName)) {
              foundMatch = true;
              const isMarked = markedFoodNames.has(foodName);
              console.log(`     ✅ Partial match "${ingredient.name}" with food "${foodName}" (marked: ${isMarked}, available: ${availableQty}, needed: ${ingredient.quantity})`);
              if (availableQty >= ingredient.quantity) {
                hasSufficientQuantity = true;
                // If it's in marked foods, count it
                if (isMarked) {
                  matchedCount++;
                  console.log(`        ✓ Sufficient quantity and marked`);
                } else {
                  console.log(`        ✓ Sufficient quantity but not marked`);
                }
              } else {
                console.log(`        ✗ Insufficient quantity`);
              }
              break;
            }
          }
        }
        
        if (!foundMatch) {
          console.log(`     ❌ No match found for "${ingredient.name}"`);
        }

        // Check if ingredient matches any expiring food (case-insensitive matching)
        if (!hasExpiringIngredient) {
          for (const expiringFoodName of expiringFoodNames) {
            if (this.ingredientMatches(ingredient.name, expiringFoodName)) {
              hasExpiringIngredient = true;
              break;
            }
          }
        }

        // If ingredient was found but doesn't have sufficient quantity, mark as insufficient
        if (foundMatch && !hasSufficientQuantity) {
          allIngredientsHaveSufficientQuantity = false;
        }
      });

      // Calculate match percentage (only count ingredients with sufficient quantity that are in marked foods)
      const matchPercentage = ingredients.length > 0 ? (matchedCount / ingredients.length) * 100 : 0;

      console.log(`   Matched count: ${matchedCount}/${ingredients.length} (${matchPercentage.toFixed(1)}%)`);
      console.log(`   Has expiring ingredient: ${hasExpiringIngredient}`);
      console.log(`   All have sufficient quantity: ${allIngredientsHaveSufficientQuantity}`);

      // Show meal if:
      // 1. 80% or more ingredients match marked foods with sufficient quantity AND all ingredients have sufficient quantity, OR
      // 2. Has at least one ingredient that expires in 7 days or less AND all ingredients have sufficient quantity AND at least 80% match marked foods
      const shouldShow = (matchPercentage >= 80 && allIngredientsHaveSufficientQuantity) || 
                        (hasExpiringIngredient && allIngredientsHaveSufficientQuantity && matchPercentage >= 80);
      
      console.log(`   Should show: ${shouldShow} (reason: ${matchPercentage >= 80 && allIngredientsHaveSufficientQuantity ? '80%+ match' : hasExpiringIngredient && allIngredientsHaveSufficientQuantity && matchPercentage >= 80 ? 'expiring + 80%+ match' : 'does not meet criteria'})`);
      
      return shouldShow;
    });

    // Reset carousel index if current index is out of bounds
    if (this.currentSuggestedIndex >= this.suggestedMeals.length) {
      this.currentSuggestedIndex = 0;
    }

    this.cdr.detectChanges();
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

