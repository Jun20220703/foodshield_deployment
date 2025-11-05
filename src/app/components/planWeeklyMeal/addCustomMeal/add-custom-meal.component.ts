import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { SidebarComponent } from '../../sidebar/sidebar.component';

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

  constructor(
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    // Query parameters에서 선택된 날짜와 meal type 받기
    this.route.queryParams.subscribe(params => {
      this.selectedDate = params['date'] || '';
      this.selectedMealType = params['mealType'] || '';
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
}

