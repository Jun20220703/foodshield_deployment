import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';

interface Recipe {
  id: string;
  name: string;
  image: string;
  description?: string;
  ingredients?: string;
  kcal?: string;
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
    private route: ActivatedRoute
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
    }
  }

  back() {
    this.router.navigate(['/browse-recipes']);
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

