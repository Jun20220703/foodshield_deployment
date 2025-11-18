import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ManageFoodInventory } from '../manageFoodInventory/manage-inventory.component';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
  imports: [RouterModule, CommonModule]
})
export class SidebarComponent implements OnInit {
  username = 'User';
  profilePhoto: string = ''; // 프로필 사진이 없을 때는 빈 문자열

  constructor(
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.loadUserProfile();
    this.checkUnreadNotifications();

    // ✅ 定时检测用户信息更新（2秒一次）
    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.loadUserProfile();
        this.checkUnreadNotifications();
      }, 2000);
    }
  }

  /** ✅ 安全加载用户信息，避免 SSR 报错 */
  loadUserProfile() {
    // ⚙️ SSR 环境防护：Node.js 下没有 localStorage
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      console.warn('⚠️ localStorage not available (SSR mode). Skipping profile load.');
      return;
    }

    try {
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        const newUsername = user.name || 'User';
        const newProfilePhoto = user.profilePhoto || '';
        
        // 변경사항이 있을 때만 업데이트
        if (this.username !== newUsername || this.profilePhoto !== newProfilePhoto) {
          this.username = newUsername;
          this.profilePhoto = newProfilePhoto;
          this.cdr.detectChanges();
        }
      }
    } catch (error) {
      console.error('❌ Error loading user profile from localStorage:', error);
    }
  }

  /** 图片加载失败回退 */
  onImageError(event: any) {
    // 이미지 로드 실패 시 기본 아바타로 변경
    if (event && event.target) {
      event.target.src = 'assets/avatar.png';
    }
  }

  unreadCount = 0;

  checkUnreadNotifications() {
  this.notificationService.getNotifications().subscribe({
    next: (notifications) => {
      const unread = notifications.filter(n => !n.read).length;

      if (this.unreadCount !== unread) {
        this.unreadCount = unread;
        this.cdr.detectChanges(); // 🟢 UI 更新
      }
    },
    error: (err) => console.error('Error loading notifications:', err),
  });
}


}
