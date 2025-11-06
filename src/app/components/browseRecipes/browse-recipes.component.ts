import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { FoodService, Food } from '../../services/food.service';

interface Recipe {
  id: string;
  name: string;
  image: string;
  description?: string;
}

interface InventoryItem {
  name: string;
  quantity: number;
  category: string;
  marked: boolean;
  expiry: string;
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

  suggestedRecipes: Recipe[] = [
    { id: '1', name: 'Chicken Rice', image: 'assets/recipes/chicken-rice.jpg' },
    { id: '2', name: 'Chicken Salad', image: 'assets/recipes/chicken-salad.jpg' },
    { id: '3', name: 'Fried Rice', image: 'assets/recipes/fried-rice.jpg' }
  ];

  moreRecipes: Recipe[] = [
    { id: '4', name: 'Omelette Rice', image: 'assets/recipes/omelette-rice.jpg' },
    { id: '5', name: 'Kimchi Fried Rice', image: 'assets/recipes/kimchi-fried-rice.jpg' },
    { id: '6', name: 'Carbonara Pasta', image: 'assets/recipes/carbonara-pasta.jpg' }
  ];

  currentSuggestedIndex: number = 0;
  currentMoreIndex: number = 0;

  searchTerm: string = '';
  selectedItemIndex: number = -1;
  inventory: InventoryItem[] = [];
  filteredInventory: InventoryItem[] = [];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private foodService: FoodService,
    private cdr: ChangeDetectorRef
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

  previousSuggested() {
    this.currentSuggestedIndex = (this.currentSuggestedIndex - 1 + this.suggestedRecipes.length) % this.suggestedRecipes.length;
  }

  nextSuggested() {
    this.currentSuggestedIndex = (this.currentSuggestedIndex + 1) % this.suggestedRecipes.length;
  }

  previousMore() {
    this.currentMoreIndex = (this.currentMoreIndex - 1 + this.moreRecipes.length) % this.moreRecipes.length;
  }

  nextMore() {
    this.currentMoreIndex = (this.currentMoreIndex + 1) % this.moreRecipes.length;
  }

  selectRecipe(recipe: Recipe) {
    // TODO: 레시피 상세 정보 표시 또는 meal plan에 추가
    console.log('Selected recipe:', recipe);
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

    this.foodService.getFoods(userId).subscribe({
      next: (data: Food[]) => {
        // status가 'inventory'인 항목만 필터링하고 InventoryItem 형식으로 변환
        this.inventory = data
          .filter((f: any) => f.owner === userId && f.status === 'inventory')
          .map((food: any) => {
            // expiry 날짜 포맷팅 (Date 객체를 DD/MM/YYYY 형식으로)
            let expiryStr = '';
            if (food.expiry) {
              const expiryDate = new Date(food.expiry);
              const day = String(expiryDate.getDate()).padStart(2, '0');
              const month = String(expiryDate.getMonth() + 1).padStart(2, '0');
              const year = expiryDate.getFullYear();
              expiryStr = `${day}/${month}/${year}`;
            }

            return {
              name: food.name,
              quantity: food.qty || 0,
              category: food.category || 'Other',
              marked: food.marked || false,
              expiry: expiryStr
            };
          });
        
        this.filteredInventory = [...this.inventory];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error loading inventory:', err);
        this.inventory = [];
        this.filteredInventory = [];
      }
    });
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
  }

  toggleFilter() {
    // Toggle filter functionality can be implemented here
    console.log('Filter toggled');
  }

  selectItem(index: number) {
    this.selectedItemIndex = index;
  }

  getCategoryIcon(category: string): string {
    const icons: { [key: string]: string } = {
      'Fruit': '🍎',
      'Vegetable': '🥬',
      'Meat': '🥩',
      'Dairy': '🥛',
      'Grains': '🌾',
      'Other': '📦'
    };
    return icons[category] || '📦';
  }
}

