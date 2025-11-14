import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FoodService } from '../../services/food.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { ReactiveFormsModule } from '@angular/forms'; // ←追加
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-edit-food',
  templateUrl: './edit-food.component.html',
  styleUrls: ['./edit-food.component.css'],
  imports: [SidebarComponent, ReactiveFormsModule, FormsModule]
})
export class EditFoodComponent implements OnInit {
  selectedEditItem: any = {};  // ← ここで宣言

  foodForm!: FormGroup;
  foodId!: string;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private foodService: FoodService
  ) {}

  ngOnInit(): void {
    // URLの:idパラメータを取得
    this.foodId = this.route.snapshot.paramMap.get('id')!;

    // フォーム初期化
    this.foodForm = this.fb.group({
      name: ['', Validators.required],
      qty: ['', Validators.required],
      expiry: ['', Validators.required],
      category: [''],
      storage: [''],
      notes: ['']
    });

    // 既存データを取得してフォームにセット
    this.foodService.getFoodById(this.foodId).subscribe({
      next: (res) => {
        // 日付の形式を YYYY-MM-DD に変換してセット
        const expiryDate = res.expiry ? res.expiry.split('T')[0] : '';
        this.foodForm.patchValue({ ...res, expiry: expiryDate });
      },
      error: (err) => console.error('Error loading food:', err)
    });
  }

  // 更新処理
  onSubmit() {
    if (this.foodForm.valid) {
      // Prepare update data with all fields
      const formValue = this.foodForm.value;
      const updateData = {
        name: formValue.name,
        qty: formValue.qty,
        expiry: formValue.expiry, // Date format: YYYY-MM-DD
        category: formValue.category,
        storage: formValue.storage,
        notes: formValue.notes || ''
      };
      
      console.log('📝 Updating food with data:', updateData);
      
      this.foodService.updateFood(this.foodId, updateData).subscribe({
        next: (updatedFood) => {
          console.log('✅ Food updated successfully:', updatedFood);
          alert('Food item updated successfully!');
          this.router.navigate(['/manage-inventory']); // 更新後一覧ページへ
        },
        error: (err) => {
          console.error('❌ Error updating food:', err);
          alert('Failed to update food item. Please try again.');
        }
      });
    } else {
      console.warn('⚠️ Form is invalid:', this.foodForm.errors);
      alert('Please fill in all required fields.');
    }
  }

  // キャンセルボタン
  cancel() {
    this.router.navigate(['/manage-inventory']);
  }
}
