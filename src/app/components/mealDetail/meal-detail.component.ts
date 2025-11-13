import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { BrowseFoodService, MarkedFood } from '../../services/browse-food.service';

interface Recipe {
  id: string;
  name: string;
  image: string;
  description?: string;
  ingredients?: string;
  kcal?: string;
}

interface IngredientInfo {
  name: string;
  quantity: number;
  markedQuantity: number;
}

@Component({
  selector: 'app-meal-detail',
  standalone: true,
  templateUrl: './meal-detail.component.html',
  styleUrls: ['./meal-detail.component.css'],
  imports: [CommonModule, SidebarComponent]
})
export class MealDetailComponent implements OnInit {
  recipeId: string = '';
  recipe: Recipe | null = null;
  imageError: boolean = false;
  ingredientsList: IngredientInfo[] = [];

  // Sample recipe data - in a real app, this would come from a service
  recipes: Recipe[] = [
    { id: '1', name: 'Chicken Rice', image: 'assets/recipes/chicken-rice.jpg', description: 'A delicious and healthy chicken rice dish.', ingredients: 'Chicken, Rice, Vegetables, Spices', kcal: '450 kcal' },
    { id: '2', name: 'Chicken Salad', image: 'assets/recipes/chicken-salad.jpg', description: 'Fresh and nutritious chicken salad.', ingredients: 'Chicken, Lettuce, Tomatoes, Cucumber, Dressing', kcal: '320 kcal' },
    { id: '3', name: 'Fried Rice', image: 'assets/recipes/fried-rice.jpg', description: 'Classic fried rice with vegetables.', ingredients: 'Rice, Eggs, Vegetables, Soy Sauce', kcal: '380 kcal' },
    { id: '4', name: 'Scrambled Eggs', image: 'assets/images/ge-food1.jpg', description: 'Simple and delicious scrambled eggs.', ingredients: 'Egg 2, Onion 1, Salt, Oil 1, Carrot 1', kcal: '250 kcal' },
    { id: '5', name: 'Potato & Veggie Hash', image: 'assets/images/ge-food2.jpg', description: 'Hearty potato and vegetable hash.', ingredients: 'Potato 2, Onion 1, Bell Pepper 1, Parsley 1, Oil 1, Salt 1', kcal: '320 kcal' },
    { id: '6', name: 'Boiled Egg', image: 'assets/images/ge-food3.jpg', description: 'Simple boiled egg.', ingredients: 'Egg 1, Salt, Water 1', kcal: '70 kcal' },
    { id: '7', name: 'Toast', image: 'assets/images/ge-food4.jpg', description: 'Classic toast with butter.', ingredients: 'Bread 1, Butter 1', kcal: '150 kcal' },
    { id: '8', name: 'Vegetable Soup', image: 'assets/images/ge-food5.jpg', description: 'Warm and comforting vegetable soup.', ingredients: 'Onion 1, Carrot 1, Potato 1, Salt 1, Water 3', kcal: '120 kcal' },
    { id: '9', name: 'Simple Salad', image: 'assets/images/ge-food6.jpg', description: 'Fresh and healthy simple salad.', ingredients: 'Lettuce 1, Tomato 1, Cucumber 1, Olive Oil 1, Salt 1', kcal: '80 kcal' },
    { id: '10', name: 'Mashed Potato', image: 'assets/images/ge-food7.jpg', description: 'Creamy mashed potatoes.', ingredients: 'Potato 2, Butter 1, Milk 1, Salt 1', kcal: '220 kcal' },
    { id: '11', name: 'Fried Rice', image: 'assets/images/ge-food8.jpg', description: 'Classic fried rice with vegetables.', ingredients: 'Rice 1, Egg 1, Carrot 1, Onion 1, Oil 1, Salt 1', kcal: '350 kcal' },
    { id: '12', name: 'Cereal', image: 'assets/images/ge-food9.jpg', description: 'Simple cereal with milk.', ingredients: 'Cereal 1, Milk 1', kcal: '200 kcal' },
    { id: '13', name: 'Omelet', image: 'assets/images/ge-food10.jpg', description: 'Delicious omelet with vegetables.', ingredients: 'Egg 2, Onion 1, Tomato 1, Oil 1, Salt 1', kcal: '180 kcal' }
  ];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private browseService: BrowseFoodService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Get recipe ID from route parameters
    this.route.params.subscribe(params => {
      this.recipeId = params['id'];
      this.loadRecipe();
    });
  }

  loadRecipe() {
    // Find recipe by ID
    this.recipe = this.recipes.find(r => r.id === this.recipeId) || null;
    
    // Reset image error state when loading new recipe
    this.imageError = false;
    
    if (!this.recipe) {
      console.error('Recipe not found:', this.recipeId);
      // Optionally redirect to browse-recipes if recipe not found
      // this.router.navigate(['/browse-recipes']);
      return;
    }

    // Parse ingredients and load marked foods
    this.parseIngredients();
    this.loadMarkedFoods();
  }

  parseIngredients() {
    if (!this.recipe || !this.recipe.ingredients) {
      this.ingredientsList = [];
      return;
    }

    // Parse ingredients from description string (e.g., "Chicken 1, Rice 1, Garlic 1" or "Chicken, Rice, Vegetables, Spices")
    const ingredients = this.recipe.ingredients.split(',').map(ing => {
      const trimmed = ing.trim();
      // Extract quantity (number at the start or end)
      const quantityMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s+|\s+(\d+(?:\.\d+)?)$/);
      let quantity = 1; // Default quantity is 1
      
      if (quantityMatch) {
        quantity = parseFloat(quantityMatch[1] || quantityMatch[2] || '1');
      }
      
      // Extract ingredient name (remove quantity numbers)
      let name = trimmed.replace(/^\d+(?:\.\d+)?\s+/, '').replace(/\s+\d+(?:\.\d+)?$/, '').trim();
      
      return { name, quantity, markedQuantity: 0 };
    }).filter(ing => {
      // Filter out only truly generic/abstract ingredients that don't represent actual food items
      const genericIngredients = ['spices', 'vegetables', 'dressing', 'milk or water'];
      const normalizedName = this.normalizeIngredientName(ing.name);
      return ing.name.length > 0 && !genericIngredients.includes(normalizedName);
    });

    this.ingredientsList = ingredients;
  }

  normalizeIngredientName(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  ingredientMatches(ingredient1: string, ingredient2: string): boolean {
    const normalized1 = this.normalizeIngredientName(ingredient1);
    const normalized2 = this.normalizeIngredientName(ingredient2);
    
    // Exact match
    if (normalized1 === normalized2) return true;
    
    // Handle singular/plural (e.g., "Egg" vs "Eggs")
    const singular1 = normalized1.replace(/s$/, '');
    const singular2 = normalized2.replace(/s$/, '');
    if (singular1 === normalized2 || normalized1 === singular2 || singular1 === singular2) {
      return true;
    }
    
    // Word boundary matching
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      const shorter = normalized1.length < normalized2.length ? normalized1 : normalized2;
      const longer = normalized1.length >= normalized2.length ? normalized1 : normalized2;
      
      const wordBoundaryRegex = new RegExp(`(^|\\s)${shorter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`, 'i');
      if (wordBoundaryRegex.test(longer)) {
        return true;
      }
    }
    
    return false;
  }

  loadMarkedFoods() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return;
    }

    // Check if ingredientsList is ready
    if (!this.ingredientsList || this.ingredientsList.length === 0) {
      console.warn('⚠️ ingredientsList is empty, retrying in 100ms...');
      setTimeout(() => {
        this.loadMarkedFoods();
      }, 100);
      return;
    }

    this.browseService.getMarkedFoods().subscribe({
      next: (markedFoods: MarkedFood[]) => {
        console.log('📦 Loaded marked foods:', markedFoods.map(f => ({ name: f.name, qty: f.qty })));
        
        // Create a map of normalized food names to total quantities
        // Also store original names for matching
        const markedFoodQuantities = new Map<string, number>();
        const markedFoodOriginalNames = new Map<string, string>(); // normalized -> original
        
        markedFoods.forEach((markedFood: MarkedFood) => {
          const normalizedName = this.normalizeIngredientName(markedFood.name);
          const currentQty = markedFoodQuantities.get(normalizedName) || 0;
          markedFoodQuantities.set(normalizedName, currentQty + (markedFood.qty || 0));
          // Store original name for matching
          if (!markedFoodOriginalNames.has(normalizedName)) {
            markedFoodOriginalNames.set(normalizedName, markedFood.name);
          }
        });

        console.log('📋 Marked food quantities:', Array.from(markedFoodQuantities.entries()));
        console.log('📋 Ingredients to match:', this.ingredientsList.map(i => i.name));

        // Update ingredients list with marked quantities from database
        // Match by name first, then get quantity separately
        const updatedIngredients = this.ingredientsList.map(ingredient => {
          let markedQty = 0;
          const normalizedIngredient = this.normalizeIngredientName(ingredient.name);
          
          console.log(`\n🔍 Matching: "${ingredient.name}" (normalized: "${normalizedIngredient}")`);
          
          // Step 1: Try direct normalized match FIRST (most reliable - exact match)
          if (markedFoodQuantities.has(normalizedIngredient)) {
            markedQty = markedFoodQuantities.get(normalizedIngredient)!;
            const originalName = markedFoodOriginalNames.get(normalizedIngredient) || normalizedIngredient;
            console.log(`   ✅ DIRECT MATCH: "${ingredient.name}" = "${originalName}" (qty: ${markedQty})`);
          } else {
            // Step 2: Try ingredientMatches method (handles singular/plural, word boundaries)
            let foundMatch = false;
            for (const [normalizedName, qty] of markedFoodQuantities.entries()) {
              const originalName = markedFoodOriginalNames.get(normalizedName) || normalizedName;
              
              if (this.ingredientMatches(ingredient.name, originalName)) {
                markedQty = qty;
                console.log(`   ✅ MATCHED: "${ingredient.name}" = "${originalName}" (qty: ${qty})`);
                foundMatch = true;
                break;
              }
            }
            
            // Step 3: Try singular/plural matching (if ingredientMatches didn't work)
            if (!foundMatch) {
              for (const [normalizedName, qty] of markedFoodQuantities.entries()) {
                const singularNormalized = normalizedName.replace(/s$/, '');
                const singularIngredient = normalizedIngredient.replace(/s$/, '');
                
                if (singularNormalized === normalizedIngredient || 
                    normalizedName === singularIngredient || 
                    singularNormalized === singularIngredient) {
                  markedQty = qty;
                  const originalName = markedFoodOriginalNames.get(normalizedName) || normalizedName;
                  console.log(`   ✅ SINGULAR/PLURAL MATCH: "${ingredient.name}" = "${originalName}" (qty: ${qty})`);
                  foundMatch = true;
                  break;
                }
              }
            }
            
            // Step 4: Try exact normalized match again (in case of any edge cases)
            if (!foundMatch) {
              for (const [normalizedName, qty] of markedFoodQuantities.entries()) {
                if (normalizedName === normalizedIngredient) {
                  markedQty = qty;
                  const originalName = markedFoodOriginalNames.get(normalizedName) || normalizedName;
                  console.log(`   ✅ EXACT NORMALIZED MATCH: "${ingredient.name}" = "${originalName}" (qty: ${qty})`);
                  foundMatch = true;
                  break;
                }
              }
            }
            
            if (!foundMatch) {
              console.log(`   ❌ NO MATCH: "${ingredient.name}"`);
              console.log(`   Available in DB:`, Array.from(markedFoodOriginalNames.values()));
            }
          }
          
          return { ...ingredient, markedQuantity: markedQty };
        });
        
        // Create completely new array to trigger change detection
        const newIngredientsList = updatedIngredients.map(ing => ({
          name: ing.name,
          quantity: ing.quantity,
          markedQuantity: ing.markedQuantity
        }));
        
        console.log('✅ Final ingredients with marked quantities:', 
          newIngredientsList.map(i => `${i.name}: ${i.markedQuantity}`));
        
        // Update ingredients list - create completely new array to trigger change detection
        this.ingredientsList = newIngredientsList.map(ing => ({
          name: ing.name,
          quantity: ing.quantity,
          markedQuantity: ing.markedQuantity
        }));
        
        console.log('🔄 Updated ingredientsList:', this.ingredientsList);
        
        // Force change detection
        try {
          if (this.cdr) {
            this.cdr.markForCheck();
            this.cdr.detectChanges();
          }
        } catch (error) {
          console.warn('ChangeDetectorRef error:', error);
        }
      },
      error: (err) => {
        console.error('Error loading marked foods:', err);
      }
    });
  }

  trackByIngredientName(index: number, ingredient: IngredientInfo): string {
    return `${ingredient.name}-${ingredient.markedQuantity}`;
  }

  back() {
    // Get section and index from query params to restore carousel position
    this.route.queryParams.subscribe(params => {
      const section = params['section'];
      const index = params['index'];
      
      if (section && index !== undefined) {
        this.router.navigate(['/browse-recipes'], {
          queryParams: { section: section, index: index }
        });
      } else {
        this.router.navigate(['/browse-recipes']);
      }
    }).unsubscribe();
  }

  planMeal() {
    // Navigate to planWeeklyMeal page
    this.router.navigate(['/planWeeklyMeal']);
  }

  onImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    // Prevent infinite loop by checking if already set to placeholder
    if (img.src && !img.src.includes('placeholder')) {
      img.src = 'assets/placeholder-recipe.jpg';
      this.imageError = true;
    } else {
      // If placeholder also fails, hide the image or show a default
      img.style.display = 'none';
    }
  }

  onImageLoad(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'block';
    this.imageError = false;
  }
}

