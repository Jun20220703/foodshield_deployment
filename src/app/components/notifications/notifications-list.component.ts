import { Component, OnInit } from '@angular/core';
import { NotificationService, Notification } from '../../services/notification.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-notifications-list',
  templateUrl: './notifications-list.component.html',
  styleUrls: ['./notifications-list.component.css'],
  imports:[SidebarComponent,CommonModule ]
})
export class NotificationsListComponent implements OnInit {
  notifications: Notification[] = [];
  activeTab: 'all' | 'unread' | 'read' = 'all';

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    this.loadNotifications();
  }

  // 🔹 通知を取得
  loadNotifications(): void {
    this.notificationService.getNotifications().subscribe({
      next: (data) => (this.notifications = data),
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
    console.log('Open detail:', n);
  }

  // 🔹 未読・既読一覧の取得（HTMLで表示数に使用）
  get unread(): Notification[] {
    return this.notifications.filter((n) => !n.read);
  }

  get read(): Notification[] {
    return this.notifications.filter((n) => n.read);
  }
}
