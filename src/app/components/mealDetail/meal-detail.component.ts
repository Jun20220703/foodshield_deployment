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

  // Sample recipe data - in a real app, this would come from a service
  recipes: Recipe[] = [
    { id: '1', name: 'Chicken Rice', image: 'assets/recipes/chicken-rice.jpg', description: 'A delicious and healthy chicken rice dish.', ingredients: 'Chicken, Rice, Vegetables, Spices', kcal: '450 kcal' },
    { id: '2', name: 'Chicken Salad', image: 'assets/recipes/chicken-salad.jpg', description: 'Fresh and nutritious chicken salad.', ingredients: 'Chicken, Lettuce, Tomatoes, Cucumber, Dressing', kcal: '320 kcal' },
    { id: '3', name: 'Fried Rice', image: 'assets/recipes/fried-rice.jpg', description: 'Classic fried rice with vegetables.', ingredients: 'Rice, Eggs, Vegetables, Soy Sauce', kcal: '380 kcal' },
    { id: '4', name: 'Omelette Rice', image: 'assets/recipes/omelette-rice.jpg', description: 'Japanese-style omelette rice.', ingredients: 'Eggs, Rice, Ketchup, Vegetables', kcal: '420 kcal' },
    { id: '5', name: 'Kimchi Fried Rice', image: 'assets/recipes/kimchi-fried-rice.jpg', description: 'Spicy Korean kimchi fried rice.', ingredients: 'Rice, Kimchi, Eggs, Sesame Oil', kcal: '400 kcal' },
    { id: '6', name: 'Carbonara Pasta', image: 'assets/recipes/carbonara-pasta.jpg', description: 'Creamy Italian carbonara pasta.', ingredients: 'Pasta, Bacon, Eggs, Parmesan Cheese, Cream', kcal: '550 kcal' }
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
}

