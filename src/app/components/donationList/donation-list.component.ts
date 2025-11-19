import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { FoodService } from '../../services/food.service';
import { ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { DonationService } from '../../services/donation.service';
import { Subject } from 'rxjs';
import { takeUntil, filter } from 'rxjs/operators';
@Component({
  selector: 'app-donation-list',
  templateUrl: './donation-list.component.html',
  styleUrls: ['./donation-list.component.css'],
  imports: [CommonModule, SidebarComponent]
})
export class DonationListComponent implements OnInit, OnDestroy {
    donations: any[] = [];
    private destroy$ = new Subject<void>();

    constructor(
        private cd: ChangeDetectorRef,
        private foodService: FoodService, 
        private router: Router,
        private donationService: DonationService){}

    ngOnInit() {
        this.loadDonations();
        
        // Reload donations when navigating to this page
        this.router.events
            .pipe(
                filter(event => event instanceof NavigationEnd),
                takeUntil(this.destroy$)
            )
            .subscribe(() => {
                // Small delay to ensure any pending API calls complete
                setTimeout(() => {
                    this.loadDonations();
                }, 200);
            });
    }
    
    ngOnDestroy() {
        this.destroy$.next();
        this.destroy$.complete();
    }

    loadDonations(){
        console.log('🔄 Loading donations...');
        this.foodService.getDonations().subscribe({
            next:(data) => {
                console.log('📦 Donations loaded from API:', data);
                this.donations = data || [];
                console.log('📋 Donations array length:', this.donations.length);
                if (this.donations.length > 0) {
                    console.log('📋 First donation:', this.donations[0]);
                }
                this.cd.detectChanges();
            },
            error: (err) =>{
                console.error('❌ Error loading donations:', err);
                this.donations = [];
                this.cd.detectChanges();
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

      this.donations = this.donations.filter(d => d._id !== donation._id);
            this.cd.detectChanges();

    },
    error: (err: any) => {  // ← 型を明示
      console.error('Error deleting donation:', err);
    }
  });
}

}
