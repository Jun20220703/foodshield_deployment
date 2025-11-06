import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { FoodService } from '../../services/food.service';
import { ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { DonationService } from '../../services/donation.service';
@Component({
  selector: 'app-donation-list',
  templateUrl: './donation-list.component.html',
  styleUrls: ['./donation-list.component.css'],
  imports: [CommonModule, SidebarComponent]
})
export class DonationListComponent implements OnInit{
    donations: any[] = [];

    constructor(
        private cd: ChangeDetectorRef,
        private foodService: FoodService, 
        private router: Router,
        private donationService: DonationService){}

    ngOnInit() {
        this.foodService.getDonations().subscribe({
            next: (res) => {
            console.log('Donations loaded: ', res);
            this.donations = res;  // これを ngFor で表示
            this.cd.detectChanges();
            },
            error: (err) => console.error(err)
        });
    }

    loadDonations(){
        this.foodService.getDonations().subscribe({
            next:(data) => {
                this.donations = data;
                console.log('Donations loaded: ', data);
            },
            error: (err) =>{
                console.error('Error loading donations:', err);
            }
        });
    }
        
    
 
 

  edit(donation: any) {
  if (!donation._id) return;
  this.router.navigate(['/edit-donation', donation._id]);
}

  delete(donation: any) {
  if (!donation._id) return;

  if (!confirm(`Are you sure you want to delete "${donation.foodId?.name}"?`)) return;

  this.donationService.deleteDonation(donation._id).subscribe({
    next: (res: any) => {   // ← 型を明示
      console.log('Donation deleted:', res);
      this.loadDonations();
    },
    error: (err: any) => {  // ← 型を明示
      console.error('Error deleting donation:', err);
    }
  });
}

}
