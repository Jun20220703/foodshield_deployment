import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { FoodService } from '../../services/food.service';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-add-food-item',
  standalone: true,
  templateUrl: './add-food-item.component.html',
  styleUrls: ['./add-food-item.component.css'],
  imports: [CommonModule, FormsModule, SidebarComponent, ReactiveFormsModule]
})


export class AddFoodItemComponent {
  foodForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private foodService: FoodService, 
    private router: Router,
  ){

    this.foodForm = this.fb.group({
      name: ['', Validators.required],
      qty: ['', [Validators.required, Validators.pattern(/^\d+$/)]], // only allow Number
      expiry: ['', Validators.required],
      category: ['', Validators.required],
      storage: ['', Validators.required],
      notes: ['']
    });
  }

  saveFood() {
  console.log('Save button clicked');
  if (this.foodForm.invalid) {
    this.foodForm.markAllAsTouched();
    return;
  }

  const rawData = this.foodForm.value;
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const userId = user.id || user._id; // Support both user.id and user._id
  
  if (!userId) {
    alert('User ID not found. Please log in again.');
    return;
  }

  const foodData = {
    ...rawData,
    qty: Number(rawData.qty),
    expiry: new Date(rawData.expiry),
    owner: userId,
    status: 'inventory' // Ensure status is set to 'inventory' for new items
  };

  console.log('submitting (converted):', foodData);

  this.foodService.addFood(foodData).subscribe({
    next: (res) => {
      console.log('✅ Food saved successfully:', res);
      this.router.navigate(['/manage-inventory']);
    },
    error: (err) => {
      console.error('❌ Error saving food:', err);
      const errorMessage = err.error?.message || err.message || 'Unknown error';
      console.error('Error details:', {
        status: err.status,
        statusText: err.statusText,
        message: errorMessage,
        body: err.error
      });
      alert(`Failed to save item: ${errorMessage}`);
    }
  });
}


  cancel() {
    this.router.navigate(['/manage-inventory']);
  }
}
