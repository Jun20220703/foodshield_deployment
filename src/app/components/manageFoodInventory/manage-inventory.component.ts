import { ChangeDetectorRef, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from "../sidebar/sidebar.component";
import { Router } from '@angular/router';
import { FoodService } from '../../services/food.service';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-food-inventory',
  templateUrl: './manage-inventory.component.html',
  styleUrls: ['./manage-inventory.component.css'],
  standalone: true,
  imports: [SidebarComponent, CommonModule, FormsModule]
})
export class ManageFoodInventory {
  foodItems: any[] = [];

  constructor (
    private foodService: FoodService, 
    private router: Router,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,   // ✅ 新增
    private notificationService: NotificationService

  ){}


  ngOnInit(){
  this.loadFoods();

  const userId = localStorage.getItem('userId');

  if (userId) {
      this.notificationService.checkExpiry(userId).subscribe({
        next: () => {
          console.log('Expiry check done on login.');
        },
        error: (err) => console.error('Error during expiry check:', err),
      });
    }
  this.route.queryParams.subscribe((params: any) => {
    const donateId = params['donateId'];
    if (donateId) {
      // 等 foods 加载完之后再找 item
      setTimeout(() => {
        const target = this.foodItems.find(f => f._id === donateId);
        if (target) {
          this.openDonateModal(target); // ✅ 自动打开 donate 弹窗
        }
      }, 500);
    }
  });
}

loadFoods() {
  // Check if we're in browser environment (not SSR)
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    console.warn('⚠️ localStorage not available (SSR mode). Skipping foods load.');
    this.foodItems = [];
    return;
  }

  // localStorage からログインユーザー情報を取得
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  console.log('Loaded user from localStorage:', user);

  // Support both user.id and user._id (MongoDB uses _id)
  const userId = user.id || user._id;

  if (!userId) {
    console.error('User ID not found in localStorage.');
    this.foodItems = [];
    return;
  }

  this.foodService.getFoods(userId).subscribe({
    next: (data) => {
      const today = new Date();
      this.foodItems = data.filter((f: any) =>   
        f.owner === userId && 
        f.status ==='inventory' &&
        (!f.expiry || new Date(f.expiry) >= today)
      );
      console.log('Filtered food items:', this.foodItems);

        this.cdr.detectChanges();
    },
    error: (err) => {
      console.error('Error loading foods:', err);
    }
  });
}

  addFoodItem() {
    this.router.navigate(['/add-food']);
  }

  openEditPage(item: any) {
  if (!item._id) return; // 念のためチェック
  this.router.navigate(['/edit-food', item._id]);
}

  showDeleteModal = false;
  selectedDeleteItem: any = null;

  openDeleteModal(item: any){
    this.selectedDeleteItem = item;
    this.showDeleteModal = true;
  }
  cancelDelete(){
    this.showDeleteModal = false;
    this.selectedDeleteItem = null;
  }

  confirmDelete() {
  if (this.selectedDeleteItem) {
    this.foodService.deleteFood(this.selectedDeleteItem._id).subscribe({
      next: () => {
        console.log(`✅ Deleted: ${this.selectedDeleteItem.name}`);
        // データを再読み込み
        this.loadFoods();

        // モーダルを閉じる処理はここで行う
        this.showDeleteModal = false;
        this.selectedDeleteItem = null;
      },
      error: (err) => {
        console.error('❌ Error deleting item:', err);
        alert('Failed to delete the item. Please try again.');
      }
    });
  }
}




  showDonateModal = false;
  selectedDonateItem: any = null;
  donationDetails = { location: '', availability: '', notes: '' };
  donateError ='';

  openDonateModal(item: any) {
  this.selectedDonateItem = item;
  this.showDonateModal = true;
  this.donationDetails = { location: '', availability: '', notes: '' };
  this.donateError = '';
}

cancelDonate() {
  this.showDonateModal = false;
  this.selectedDonateItem = null;
  this.donationDetails = { location: '', availability: '', notes: '' };
}

confirmDonate() {
  // Check if we're in browser environment (not SSR)
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    console.warn('⚠️ localStorage not available (SSR mode). Cannot donate.');
    this.donateError = 'Cannot donate in SSR mode.';
    return;
  }

  // 必須項目チェック
  if (!this.donationDetails.location.trim() || !this.donationDetails.availability.trim()) {
    this.donateError = 'Pickup location and availability are required.';
    return;
  }
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  // Support both user.id and user._id (MongoDB uses _id)
  // const userId = user?.id || user?._id;

  const userId=localStorage.getItem('userId');
  if(!userId){
    this.donateError = 'User not logged in.';
    return;
  }


  const donationData = {
    foodId: this.selectedDonateItem._id,
    qty: this.selectedDonateItem.qty,
    location: this.donationDetails.location,
    availability: this.donationDetails.availability,
    notes: this.donationDetails.notes,
    owner: userId
  };

  console.log('🧾 donationData before sending:', donationData); // ✅ 追加

  this.foodService.donateFood(this.selectedDonateItem._id, donationData).subscribe({
    next: (res) => {
      console.log('Donation saved:', res);
      this.foodService.updateFoodStatus(this.selectedDonateItem._id, 'donation').subscribe({
        next: (updateRes) => {
          console.log('Food status updated to donation:', updateRes);
          alert('Donation successfully added!');
          // モーダル閉じて再読み込み
          this.showDonateModal = false;
          this.selectedDonateItem = null;
          this.donationDetails = { location: '', availability: '', notes: '' };
          this.donateError = '';
          this.loadFoods();
          this.router.navigate(['/donation-list']);
        },
        error: (err) => {
          console.error('Error updating food status:', err);
          this.donateError = 'Failed to update food status. Please try again.';
        }
      });
    },
    error: (err) => {
      console.error('Error saving donation:', err);
      this.donateError = 'Failed to save donation.Please try again.';
    }
  })

  
}

goToDonationList() {
  this.router.navigate(['/donation-list']);
  console.log('Navigate to Donation List');
}

isExpiringSoon(expiryDate: string): boolean{
  const today = new Date();
  const expiry = new Date(expiryDate);

  const diffInTime = expiry.getTime() - today.getTime();
  const diffInDays = diffInTime / (1000 * 3600 * 24);

  return diffInDays <= 5 && diffInDays >= 0;
}


}
