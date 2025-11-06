import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FoodService } from '../../services/food.service';
import { DonationService } from '../../services/donation.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-edit-donation',
  templateUrl: './edit-donation.component.html',
  styleUrls: ['./edit-donation.component.css'],
  imports: [SidebarComponent, ReactiveFormsModule]
})
export class EditDonationComponent implements OnInit {
  donationForm!: FormGroup;
  donationId!: string;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private donationService: DonationService,
    private foodService: FoodService
  ) {}

  ngOnInit(): void {
    this.donationId = this.route.snapshot.paramMap.get('id')!;
    
    // フォーム初期化
    this.donationForm = this.fb.group({
      location: ['', Validators.required],
      availability: ['', Validators.required],
      notes: ['']
    });

    // 既存データを取得してフォームにセット
     this.donationService.getDonationById(this.donationId).subscribe({
      next: (res) => {
        this.donationForm.patchValue({
          location: res.location,
          availability: res.availability,
          notes: res.notes
        });
      },
      error: (err) => console.error('Error loading donation:', err)
    });
  }

  onSubmit() {
    if (this.donationForm.valid) {
      this.donationService.updateDonation(this.donationId, this.donationForm.value)
        .subscribe({
          next: () => {
            alert('Donation updated successfully!');
            this.router.navigate(['/donation-list']);
          },
          error: (err) => console.error('Error updating donation:', err)
        });
    }
  }

  cancel() {
    this.router.navigate(['/donation-list']);
  }
}
