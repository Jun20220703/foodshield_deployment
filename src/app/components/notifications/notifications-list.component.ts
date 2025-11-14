import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { NotificationService, Notification } from '../../services/notification.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router'; 
import { filter } from 'rxjs/operators';
@Component({
  selector: 'app-notifications-list',
  templateUrl: './notifications-list.component.html',
  styleUrls: ['./notifications-list.component.css'],
  imports:[SidebarComponent,CommonModule ]
})
export class NotificationsListComponent implements OnInit {
  notifications: Notification[] = [];
  activeTab: 'all' | 'unread' | 'read' = 'all';

  constructor(
    private notificationService: NotificationService,
    private router:Router,
    private cdr: ChangeDetectorRef   // ✅ 追加

  ) {}

  ngOnInit(): void {
    const userId = localStorage.getItem('userId'); // ← ログイン時に保存されている前提
  if (userId) {
    this.notificationService.checkExpiry(userId).subscribe({
      next: (res) => {
        console.log('🟢 Expiry check result:', res);
        this.loadNotifications();
      },
      error: (err) => console.error('❌ Error checking expiry:', err),
    });
  } else {
    this.loadNotifications();
  }
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        if (event.urlAfterRedirects === '/notifications') {
          this.loadNotifications();
        }
      });
  }

  // 🔹 通知を取得
  loadNotifications(): void {
    this.notificationService.getNotifications().subscribe({
      next: (data) => {
        this.notifications = data;
        this.cdr.detectChanges();   // ✅ ここがポイント
      },
      error: (err) => console.error('Error fetching notifications:', err),
    });
  }

  // 🔹 タブ切り替え
  setTab(tab: 'all' | 'unread' | 'read'): void {
    this.activeTab = tab;
  }

  // 🔹 各タブで表示する通知をフィルタリング
  displayed(): Notification[] {
    switch (this.activeTab) {
      case 'unread':
        return this.notifications.filter((n) => !n.read);
      case 'read':
        return this.notifications.filter((n) => n.read);
      default:
        return this.notifications;
    }
  }

  // 🔹 各通知タイプのバッジ表示
  badge(type: string): string {
    switch (type) {
      case 'donation': return 'Donation';
      case 'inventory': return 'Inventory';
      case 'system': return 'System';
      default: return 'Notice';
    }
  }

  // 🔹 通知詳細を開く（クリック時）
  openDetail(n: Notification): void {
    if (!n.read && n._id) {
      this.notificationService.markAsRead(n._id).subscribe(() => {
        n.read = true; // 即時UI更新
      });
    }
    if(n._id){
      this.router.navigate(['/notifications', n._id]);
    }
    console.log('Open detail:', n);
  }

  // 🔹 未読・既読一覧の取得（HTMLで表示数に使用）
  get unread(): Notification[] {
    return this.notifications.filter((n) => !n.read);
  }

  get read(): Notification[] {
    return this.notifications.filter((n) => n.read);
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

}
