import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { BrowseFoodService, MarkedFood, Food } from '../../services/browse-food.service';

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
  nonMarkedQuantity: number;
  daysUntilExpiry?: number;
  expiryLocation?: 'marked' | 'non-marked' | 'both';
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
    { id: '1', name: 'Chicken Rice', image: 'assets/images/su-food1.jpg', description: 'A delicious and healthy chicken rice dish.', ingredients: 'Chicken 1, Rice 1, Garlic 1, Soy Sauce 1, Green Onion 1, Cucumber 1', kcal: '450 kcal' },
    { id: '2', name: 'Chicken Salad', image: 'assets/images/su-food2.jpg', description: 'Fresh and nutritious chicken salad.', ingredients: 'Lettuce 3, Tomato 1, Cucumber 1, Chicken 1, Dressing 1', kcal: '320 kcal' },
    { id: '3', name: 'Spaghetti', image: 'assets/images/su-food3.jpg', description: 'Classic spaghetti with garlic and olive oil.', ingredients: 'Spaghetti Noodles 1, Garlic 2, Olive Oil 1, Salt 1, Black Pepper 1', kcal: '380 kcal' },
    { id: '4', name: 'Kimchi Fried Rice', image: 'assets/images/su-food4.jpg', description: 'Delicious kimchi fried rice.', ingredients: 'Rice 1, Kimchi 2, Egg 1, Green Onion 1, Soy Sauce 1', kcal: '400 kcal' },
    { id: '5', name: 'Burger', image: 'assets/images/su-food5.jpg', description: 'Classic burger with all the fixings.', ingredients: 'Burger Bun 1, Meat Patty 1, Lettuce 1, Tomato 1, Cheese 1', kcal: '550 kcal' },
    { id: '6', name: 'Tuna Mayo Rice', image: 'assets/images/su-food6.jpg', description: 'Simple and tasty tuna mayo rice.', ingredients: 'Rice 1, Tuna Can 1, Mayonnaise 1, Soy sauce 1, Seaweed Flakes 1', kcal: '420 kcal' },
    { id: '7', name: 'Tteokbokki', image: 'assets/images/su-food7.jpg', description: 'Spicy Korean rice cakes.', ingredients: 'Rice Cake 1, Gochujang 1, Sugar 1, Green Onion 1, Fish Cake 1', kcal: '350 kcal' },
    { id: '8', name: 'Tomato Pasta', image: 'assets/images/su-food8.jpg', description: 'Classic tomato pasta.', ingredients: 'Pasta Noodles 1, Tomato Sauce 2, Onion 1, Garlic 2, Olive Oil 2', kcal: '450 kcal' },
    { id: '9', name: 'Omurice', image: 'assets/images/su-food9.jpg', description: 'Japanese-style omelet rice.', ingredients: 'Rice 1, Egg 2, Onion 1, Ketchup 1, Ham 1', kcal: '480 kcal' },
    { id: '10', name: 'Pancake', image: 'assets/images/su-food10.jpg', description: 'Fluffy pancakes.', ingredients: 'Pancake Mix 2, Egg 1, Milk 1, Butter 1, Sugar 1', kcal: '320 kcal' },
    { id: '11', name: 'Carbonara Pasta', image: 'assets/images/su-food11.jpg', description: 'Creamy carbonara pasta.', ingredients: 'Pasta Noodles 1, Egg 1, Bacon 1, Parmesan Cheese 1, Black Pepper 1', kcal: '520 kcal' },
    { id: '12', name: 'Cheese Sandwich', image: 'assets/images/su-food12.jpg', description: 'Classic cheese sandwich.', ingredients: 'Bread 2, Ham 1, Cheese 1, Lettuce 1, Tomato 1', kcal: '380 kcal' },
    { id: '13', name: 'Teriyaki Chicken', image: 'assets/images/su-food13.jpg', description: 'Sweet and savory teriyaki chicken.', ingredients: 'Chicken 1, Soy Sauce 2, Sugar 1, Garlic 1, Green Onion 1', kcal: '420 kcal' },
    { id: '14', name: 'Japanese Curry Rice', image: 'assets/images/su-food14.jpg', description: 'Comforting Japanese curry.', ingredients: 'Rice 1, Curry Roux 1, Potato 1, Carrot 1, Onion 1', kcal: '480 kcal' },
    { id: '15', name: 'Shrimp Fried Rice', image: 'assets/images/su-food15.jpg', description: 'Delicious shrimp fried rice.', ingredients: 'Rice 1, Shrimp 1, Egg 1, Garlic 1, Soy Sauce 1', kcal: '400 kcal' },
    { id: '16', name: 'Scrambled Eggs', image: 'assets/images/ge-food1.jpg', description: 'Simple and delicious scrambled eggs.', ingredients: 'Egg 2, Onion 1, Salt, Oil 1, Carrot 1', kcal: '250 kcal' },
    { id: '17', name: 'Potato & Veggie Hash', image: 'assets/images/ge-food2.jpg', description: 'Hearty potato and vegetable hash.', ingredients: 'Potato 2, Onion 1, Bell Pepper 1, Parsley 1, Oil 1, Salt 1', kcal: '320 kcal' },
    { id: '18', name: 'Boiled Egg', image: 'assets/images/ge-food3.jpg', description: 'Simple boiled egg.', ingredients: 'Egg 1, Salt, Water 1', kcal: '70 kcal' },
    { id: '19', name: 'Toast', image: 'assets/images/ge-food4.jpg', description: 'Classic toast with butter.', ingredients: 'Bread 1, Butter 1', kcal: '150 kcal' },
    { id: '20', name: 'Vegetable Soup', image: 'assets/images/ge-food5.jpg', description: 'Warm and comforting vegetable soup.', ingredients: 'Onion 1, Carrot 1, Potato 1, Salt 1, Water 3', kcal: '120 kcal' },
    { id: '21', name: 'Simple Salad', image: 'assets/images/ge-food6.jpg', description: 'Fresh and healthy simple salad.', ingredients: 'Lettuce 1, Tomato 1, Cucumber 1, Olive Oil 1, Salt 1', kcal: '80 kcal' },
    { id: '22', name: 'Mashed Potato', image: 'assets/images/ge-food7.jpg', description: 'Creamy mashed potatoes.', ingredients: 'Potato 2, Butter 1, Milk 1, Salt 1', kcal: '220 kcal' },
    { id: '23', name: 'Fried Rice', image: 'assets/images/ge-food8.jpg', description: 'Classic fried rice with vegetables.', ingredients: 'Rice 1, Egg 1, Carrot 1, Onion 1, Oil 1, Salt 1', kcal: '350 kcal' },
    { id: '24', name: 'Cereal', image: 'assets/images/ge-food9.jpg', description: 'Simple cereal with milk.', ingredients: 'Cereal 1, Milk 1', kcal: '200 kcal' },
    { id: '25', name: 'Omelet', image: 'assets/images/ge-food10.jpg', description: 'Delicious omelet with vegetables.', ingredients: 'Egg 2, Onion 1, Tomato 1, Oil 1, Salt 1', kcal: '180 kcal' }
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
      
      return { name, quantity, markedQuantity: 0, nonMarkedQuantity: 0, daysUntilExpiry: undefined, expiryLocation: undefined };
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
        console.log('📦 Loaded marked foods:', markedFoods.map(f => ({ name: f.name, qty: f.qty, expiry: f.expiry })));
        
        // Create a map of normalized food names to total quantities
        // Also store original names and expiry info for matching
        const markedFoodQuantities = new Map<string, number>();
        const markedFoodOriginalNames = new Map<string, string>(); // normalized -> original
        const markedFoodExpiry = new Map<string, { days: number; expiry: string }>(); // normalized -> expiry info
        
        markedFoods.forEach((markedFood: MarkedFood) => {
          const normalizedName = this.normalizeIngredientName(markedFood.name);
          const currentQty = markedFoodQuantities.get(normalizedName) || 0;
          markedFoodQuantities.set(normalizedName, currentQty + (markedFood.qty || 0));
          // Store original name for matching
          if (!markedFoodOriginalNames.has(normalizedName)) {
            markedFoodOriginalNames.set(normalizedName, markedFood.name);
          }
          // Store expiry info (use the earliest expiry if multiple entries)
          if (markedFood.expiry) {
            const days = this.getDaysUntilExpiry(markedFood.expiry);
            const existing = markedFoodExpiry.get(normalizedName);
            if (!existing || days < existing.days) {
              markedFoodExpiry.set(normalizedName, { days, expiry: markedFood.expiry });
            }
          }
        });

        console.log('📋 Marked food quantities:', Array.from(markedFoodQuantities.entries()));
        console.log('📋 Marked food expiry info:', Array.from(markedFoodExpiry.entries()).map(([name, info]) => `${name}: ${info.days} days`));
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
          
          // Get expiry info if found in marked foods
          let daysUntilExpiry: number | undefined;
          let expiryLocation: 'marked' | 'non-marked' | 'both' | undefined;
          
          if (markedQty > 0) {
            // Try direct match first
            if (markedFoodExpiry.has(normalizedIngredient)) {
              daysUntilExpiry = markedFoodExpiry.get(normalizedIngredient)!.days;
              expiryLocation = 'marked';
              console.log(`   📅 Expiry info (direct) for "${ingredient.name}": ${daysUntilExpiry} days (${expiryLocation})`);
            } else {
              // Try flexible matching for expiry
              for (const [normalizedName, expiryInfo] of markedFoodExpiry.entries()) {
                const originalName = markedFoodOriginalNames.get(normalizedName) || normalizedName;
                if (this.ingredientMatches(ingredient.name, originalName)) {
                  daysUntilExpiry = expiryInfo.days;
                  expiryLocation = 'marked';
                  console.log(`   📅 Expiry info (flexible match) for "${ingredient.name}": ${daysUntilExpiry} days (${expiryLocation})`);
                  break;
                }
              }
            }
          }
          
          return { 
            ...ingredient, 
            markedQuantity: markedQty, 
            nonMarkedQuantity: ingredient.nonMarkedQuantity || 0,
            daysUntilExpiry: daysUntilExpiry !== undefined ? daysUntilExpiry : ingredient.daysUntilExpiry,
            expiryLocation: expiryLocation || ingredient.expiryLocation
          };
        });
        
        // Create completely new array to trigger change detection
        const newIngredientsList = updatedIngredients.map(ing => ({
          name: ing.name,
          quantity: ing.quantity,
          markedQuantity: ing.markedQuantity,
          nonMarkedQuantity: ing.nonMarkedQuantity || 0
        }));
        
        console.log('✅ Final ingredients with marked quantities:', 
          newIngredientsList.map(i => `${i.name}: ${i.markedQuantity}`));
        
        // Update ingredients list - create completely new array to trigger change detection
        this.ingredientsList = newIngredientsList.map(ing => ({
          name: ing.name,
          quantity: ing.quantity,
          markedQuantity: ing.markedQuantity,
          nonMarkedQuantity: ing.nonMarkedQuantity || 0
        }));
        
        console.log('🔄 Updated ingredientsList:', this.ingredientsList);
        
        // After loading marked foods, check non-marked foods for items not found in marked
        this.loadNonMarkedFoods();
      },
      error: (err) => {
        console.error('Error loading marked foods:', err);
        // Still try to load non-marked foods
        this.loadNonMarkedFoods();
      }
    });
  }

  loadNonMarkedFoods() {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      console.warn('⚠️ Window or localStorage not available for non-marked foods');
      return;
    }

    // Check if ingredientsList is ready
    if (!this.ingredientsList || this.ingredientsList.length === 0) {
      console.warn('⚠️ ingredientsList is empty, cannot load non-marked foods');
      return;
    }

    console.log('🔄 Loading non-marked foods for', this.ingredientsList.length, 'ingredients');

    this.browseService.getFoods().subscribe({
      next: (allFoods: Food[]) => {
        console.log('📦 Loaded non-marked foods:', allFoods.length, 'items');
        
        // Get current user ID to filter foods
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const userId = user.id || '';

        // Filter non-marked foods (status 'inventory' and owner matches)
        const nonMarkedFoods = allFoods.filter((food: Food) => {
          return food.owner === userId && (!food.status || food.status === 'inventory');
        });

        // Create a map of normalized food names to total quantities and expiry info
        const nonMarkedFoodQuantities = new Map<string, number>();
        const nonMarkedFoodOriginalNames = new Map<string, string>();
        const nonMarkedFoodExpiry = new Map<string, { days: number; expiry: string }>(); // normalized -> expiry info

        nonMarkedFoods.forEach((food: Food) => {
          const normalizedName = this.normalizeIngredientName(food.name);
          const currentQty = nonMarkedFoodQuantities.get(normalizedName) || 0;
          nonMarkedFoodQuantities.set(normalizedName, currentQty + (food.qty || 0));
          if (!nonMarkedFoodOriginalNames.has(normalizedName)) {
            nonMarkedFoodOriginalNames.set(normalizedName, food.name);
          }
          // Store expiry info (use the earliest expiry if multiple entries)
          if (food.expiry) {
            const expiryStr = this.formatExpiryDate(food.expiry);
            const days = this.getDaysUntilExpiry(expiryStr);
            const existing = nonMarkedFoodExpiry.get(normalizedName);
            if (!existing || days < existing.days) {
              nonMarkedFoodExpiry.set(normalizedName, { days, expiry: expiryStr });
            }
          }
        });

        console.log('📋 Non-marked food quantities:', Array.from(nonMarkedFoodQuantities.entries()));
        console.log('📋 Non-marked food expiry info:', Array.from(nonMarkedFoodExpiry.entries()).map(([name, info]) => `${name}: ${info.days} days`));

        // Update ingredients list - check non-marked foods for items not in marked foods
        const updatedIngredientsList = this.ingredientsList.map(ingredient => {
          // Only check non-marked if not found in marked foods
          if (ingredient.markedQuantity === 0) {
            let nonMarkedQty = 0;
            const normalizedIngredient = this.normalizeIngredientName(ingredient.name);

            // Step 1: Try direct normalized match
            if (nonMarkedFoodQuantities.has(normalizedIngredient)) {
              nonMarkedQty = nonMarkedFoodQuantities.get(normalizedIngredient)!;
              const originalName = nonMarkedFoodOriginalNames.get(normalizedIngredient) || normalizedIngredient;
              console.log(`   ✅ NON-MARKED MATCH: "${ingredient.name}" = "${originalName}" (qty: ${nonMarkedQty})`);
            } else {
              // Step 2: Try ingredientMatches method
              let foundMatch = false;
              for (const [normalizedName, qty] of nonMarkedFoodQuantities.entries()) {
                const originalName = nonMarkedFoodOriginalNames.get(normalizedName) || normalizedName;
                
                if (this.ingredientMatches(ingredient.name, originalName)) {
                  nonMarkedQty = qty;
                  console.log(`   ✅ NON-MARKED MATCHED: "${ingredient.name}" = "${originalName}" (qty: ${qty})`);
                  foundMatch = true;
                  break;
                }
              }
              
              // Step 3: Try singular/plural matching
              if (!foundMatch) {
                for (const [normalizedName, qty] of nonMarkedFoodQuantities.entries()) {
                  const singularNormalized = normalizedName.replace(/s$/, '');
                  const singularIngredient = normalizedIngredient.replace(/s$/, '');
                  
                  if (singularNormalized === normalizedIngredient || 
                      normalizedName === singularIngredient || 
                      singularNormalized === singularIngredient) {
                    nonMarkedQty = qty;
                    const originalName = nonMarkedFoodOriginalNames.get(normalizedName) || normalizedName;
                    console.log(`   ✅ NON-MARKED SINGULAR/PLURAL MATCH: "${ingredient.name}" = "${originalName}" (qty: ${qty})`);
                    foundMatch = true;
                    break;
                  }
                }
              }
            }

            // Get expiry info if found in non-marked foods
            let daysUntilExpiry: number | undefined = ingredient.daysUntilExpiry;
            let expiryLocation: 'marked' | 'non-marked' | 'both' | undefined = ingredient.expiryLocation;
            
            if (nonMarkedQty > 0 && nonMarkedFoodExpiry.has(normalizedIngredient)) {
              const expiryInfo = nonMarkedFoodExpiry.get(normalizedIngredient)!;
              // If already has expiry from marked, compare and use the earliest
              if (daysUntilExpiry === undefined || expiryInfo.days < daysUntilExpiry) {
                daysUntilExpiry = expiryInfo.days;
                expiryLocation = ingredient.markedQuantity > 0 ? 'both' : 'non-marked';
                console.log(`   📅 Expiry info for "${ingredient.name}": ${daysUntilExpiry} days (${expiryLocation})`);
              } else if (ingredient.markedQuantity > 0) {
                expiryLocation = 'both';
                console.log(`   📅 Expiry info (both) for "${ingredient.name}": ${daysUntilExpiry} days (${expiryLocation})`);
              }
            } else if (nonMarkedQty > 0) {
              // Try flexible matching for expiry
              for (const [normalizedName, expiryInfo] of nonMarkedFoodExpiry.entries()) {
                const originalName = nonMarkedFoodOriginalNames.get(normalizedName) || normalizedName;
                if (this.ingredientMatches(ingredient.name, originalName)) {
                  if (daysUntilExpiry === undefined || expiryInfo.days < daysUntilExpiry) {
                    daysUntilExpiry = expiryInfo.days;
                    expiryLocation = ingredient.markedQuantity > 0 ? 'both' : 'non-marked';
                    console.log(`   📅 Expiry info (flexible match) for "${ingredient.name}": ${daysUntilExpiry} days (${expiryLocation})`);
                    break;
                  }
                }
              }
            }
            
            return { 
              ...ingredient, 
              nonMarkedQuantity: nonMarkedQty,
              daysUntilExpiry,
              expiryLocation
            };
          }
          
          // If already found in marked foods, keep nonMarkedQuantity as 0 but preserve expiry info
          return { ...ingredient };
        });

        // Create completely new array to trigger change detection
        const finalIngredientsList = updatedIngredientsList.map(ing => ({
          name: ing.name,
          quantity: ing.quantity,
          markedQuantity: ing.markedQuantity,
          nonMarkedQuantity: ing.nonMarkedQuantity || 0,
          daysUntilExpiry: ing.daysUntilExpiry,
          expiryLocation: ing.expiryLocation
        }));

        console.log('✅ Final ingredients with all quantities:', 
          finalIngredientsList.map(i => `${i.name}: Marked=${i.markedQuantity}, Non-Marked=${i.nonMarkedQuantity}, DaysUntilExpiry=${i.daysUntilExpiry}`));
        
        // Update ingredients list - create completely new array reference
        this.ingredientsList = finalIngredientsList.map(ing => ({
          name: ing.name,
          quantity: ing.quantity,
          markedQuantity: ing.markedQuantity,
          nonMarkedQuantity: ing.nonMarkedQuantity || 0,
          daysUntilExpiry: ing.daysUntilExpiry,
          expiryLocation: ing.expiryLocation
        }));
        
        console.log('🔄 Updated ingredientsList with non-marked:', this.ingredientsList);
        console.log('🔍 Checking non-marked items:', 
          this.ingredientsList.filter(i => i.nonMarkedQuantity > 0).map(i => `${i.name}: ${i.nonMarkedQuantity}`));
        
        // Debug expiring items (include expired items too, <= 7 days)
        const expiringItems = this.ingredientsList.filter(i => 
          i.daysUntilExpiry !== undefined && i.daysUntilExpiry <= 7
        );
        console.log('🔴 Checking expiring items (<=7 days):', 
          expiringItems.map(i => `${i.name}: ${i.daysUntilExpiry} days (${i.expiryLocation})`));
        console.log('🔴 Expiring items count:', expiringItems.length);
        console.log('🔴 All ingredients with expiry:', 
          this.ingredientsList.map(i => `${i.name}: daysUntilExpiry=${i.daysUntilExpiry}, expiryLocation=${i.expiryLocation}`));
        
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
        console.error('Error loading non-marked foods:', err);
      }
    });
  }

  getDaysUntilExpiry(expiry: string): number {
    if (!expiry) return 999; // No expiry date means far future
    
    try {
      // Parse expiry date (DD/MM/YYYY format)
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
      return 999; // Error parsing date, return large number
    }
  }

  formatExpiryDate(expiry: string | Date): string {
    if (!expiry) return '';
    
    try {
      const expiryDate = typeof expiry === 'string' ? new Date(expiry) : expiry;
      const day = String(expiryDate.getDate()).padStart(2, '0');
      const month = String(expiryDate.getMonth() + 1).padStart(2, '0');
      const year = expiryDate.getFullYear();
      return `${day}/${month}/${year}`;
    } catch (error) {
      return '';
    }
  }

  trackByIngredientName(index: number, ingredient: IngredientInfo): string {
    return `${ingredient.name}-${ingredient.markedQuantity}-${ingredient.nonMarkedQuantity}-${ingredient.daysUntilExpiry || 0}`;
  }

  getExpiryMessage(daysUntilExpiry: number | undefined): string {
    if (daysUntilExpiry === undefined) return '';
    
    if (daysUntilExpiry < 0) {
      const daysAgo = Math.abs(daysUntilExpiry);
      return `Expired ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago`;
    } else {
      return `Expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`;
    }
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

