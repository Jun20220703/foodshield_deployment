import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Notification, NotificationService } from '../../services/notification.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-notification-detail',
  templateUrl: './notification-detail.component.html',
  styleUrls: ['./notification-detail.component.css'],
  imports: [SidebarComponent, CommonModule]
})
export class NotificationDetailComponent implements OnInit {
  notification?: Notification;


  constructor(
    private route: ActivatedRoute,
    private notificationService: NotificationService,
    private router: Router,
    private cdr: ChangeDetectorRef, // ✅ 追加,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      console.log('🟢 id:', id); // ← これを追加
      // ✅ バックエンドから1件取得
      this.notificationService.getById(id).subscribe({
        next: (data) => {
          this.notification = data;
          this.cdr.detectChanges(); // ✅ UI更新を強制


          // 👇 Detailページを開いたら既読化
          if (!data.read && data._id) {
            this.notificationService.markAsRead(data._id).subscribe(() => {
              this.notification!.read = true;
            });
          }
        },
        error: (err) => console.error('Error fetching notification:', err)
      });

    }
  }
  getEmoji(type: string): string {
  switch (type) {
    case 'expiry':
      return '⏰'; // 期限間近
    case 'expired':
      return '⚠️'; // 期限切れ
    case 'inventory':
      return '📦'; // 在庫関連
    case 'low_quantity':
      return '🔔'; // 残りわずか
    case 'donation':
      return '❤️'; // 寄付
    default:
      return '📢'; // その他
  }
}


goToDonationList():void{
  this.router.navigate(['/donation-list']);
}
  back(): void {
    this.router.navigate(['/notifications-list']);
  }
}
