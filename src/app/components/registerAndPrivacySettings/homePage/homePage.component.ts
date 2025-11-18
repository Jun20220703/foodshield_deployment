import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { SidebarComponent } from '../../sidebar/sidebar.component';
import { NotificationService } from '../../../services/notification.service';
@Component({
  selector: 'app-home-page',
  standalone: true,
  templateUrl: './homePage.component.html',
  styleUrls: ['./homePage.component.css'],
  imports: [CommonModule, RouterModule, HttpClientModule, SidebarComponent]
})
export class HomePageComponent implements OnInit {
  showWelcomeMessage: boolean = false;
  show2FASetupMessage: boolean = false;

  constructor(
    private router: Router, 
    private route: ActivatedRoute, 
    private http: HttpClient, 
    private cdr: ChangeDetectorRef,
    private notificationService: NotificationService
  ) {
    console.log('HomePageComponent constructor called. cdr:', this.cdr);
    this.checkForNewUser();
  }

  ngOnInit() {
    this.checkForNewUser();

    const userId = localStorage.getItem('userId');

    if (userId) {
      this.notificationService.checkExpiry(userId).subscribe({
        next: () => {
          console.log('Expiry check done on login.');
        },
        error: (err) => console.error('Error during expiry check:', err),
      });
    }

  }

  checkForNewUser() {
    // URL 파라미터나 localStorage에서 새 사용자 여부 확인
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const isNewUser = urlParams.get('newUser') === 'true';
      const show2FASetupMessage = localStorage.getItem('show2FASetupMessage');
      
      console.log('=== HOME PAGE CHECK ===');
      console.log('Checking for new user:', { isNewUser, url: window.location.href });
      console.log('Checking for 2FA setup message:', show2FASetupMessage);
      console.log('All localStorage keys:', Object.keys(localStorage));
      
      if (isNewUser) {
        // 새 사용자인 경우 환영 메시지 표시
        this.showWelcomeMessage = true;
        console.log('Showing welcome message for new user');
        
        // URL에서 newUser 파라미터 제거 (새로고침 시 중복 표시 방지)
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: {},
          replaceUrl: true
        });
      } else if (show2FASetupMessage === 'true') {
        // 로그인 직후에만 2FA 상태를 확인 (show2FASetupMessage 플래그가 있을 때만)
        console.log('show2FASetupMessage is true, checking 2FA status...');
        this.check2FAStatus();
      } else {
        console.log('No conditions met for showing messages');
        console.log('isNewUser:', isNewUser);
        console.log('show2FASetupMessage:', show2FASetupMessage);
      }
    }
  }

  check2FAStatus() {
    const userId = localStorage.getItem('userId');
    console.log('=== CHECKING 2FA STATUS ===');
    console.log('userId from localStorage:', userId);
    
    if (!userId) {
      console.log('No userId found, not showing 2FA setup message');
      return;
    }

    console.log('Checking 2FA status for user:', userId);
    console.log('Making API call to:', `http://localhost:5001/api/users/profile/${userId}`);
    
    // 사용자의 2FA 상태를 백엔드에서 확인
    this.http.get(`http://localhost:5001/api/users/profile/${userId}`)
      .subscribe({
        next: (response: any) => {
          console.log('=== API RESPONSE ===');
          console.log('User profile response:', response);
          console.log('twoFactorAuth object:', response.twoFactorAuth);
          const twoFactorEnabled = response.twoFactorAuth?.isEnabled || false;
          console.log('2FA status from backend:', twoFactorEnabled);
          console.log('twoFactorEnabled type:', typeof twoFactorEnabled);
          console.log('twoFactorEnabled === false:', twoFactorEnabled === false);
          
          if (!twoFactorEnabled) {
            // 2FA가 비활성화된 경우에만 메시지 표시
            this.show2FASetupMessage = true;
            console.log('✅ Showing 2FA setup message - 2FA not enabled');
            console.log('show2FASetupMessage set to:', this.show2FASetupMessage);
            
            // setTimeout을 사용하여 다음 tick에서 UI 업데이트
            setTimeout(() => {
              console.log('Setting show2FASetupMessage to true in setTimeout');
              this.show2FASetupMessage = true;
              if (this.cdr) {
                this.cdr.detectChanges();
                console.log('UI update triggered in setTimeout');
              }
            }, 0);
          } else {
            console.log('❌ 2FA is enabled, not showing setup message');
          }
          
          // 플래그 제거 (한 번만 표시되도록)
          localStorage.removeItem('show2FASetupMessage');
          console.log('show2FASetupMessage flag removed - message will not show again until next login');
        },
        error: (error) => {
          console.error('=== API ERROR ===');
          console.error('Failed to check 2FA status:', error);
          console.error('Error status:', error.status);
          console.error('Error message:', error.message);
          // 오류가 발생해도 플래그는 제거
          localStorage.removeItem('show2FASetupMessage');
        }
      });
  }

  goToAccountSettings() {
    this.router.navigate(['/account-settings'], { queryParams: { tab: 'privacy' } });
    this.dismissWelcomeMessage();
  }

  dismissWelcomeMessage() {
    this.showWelcomeMessage = false;
    console.log('Welcome message dismissed');
  }

  dismiss2FASetupMessage() {
    this.show2FASetupMessage = false;
    console.log('2FA setup message dismissed');
    if (this.cdr) {
      this.cdr.detectChanges();
    } else {
      console.error('ChangeDetectorRef is undefined when trying to call detectChanges in dismiss!');
    }
  }

  goToAccountSettingsFrom2FA() {
    this.router.navigate(['/account-settings'], { queryParams: { tab: 'privacy' } });
    this.dismiss2FASetupMessage();
  }

  onLogout() {
    const confirmed = confirm('Are you sure to log out?');
    if (confirmed) {
      // 로그아웃 처리 (토큰 제거, 로그인 페이지로 이동 등)
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      alert('You have been logged out successfully.');
      this.router.navigate(['/login']);
    }
    // 'No'를 누르면 아무것도 하지 않음 (취소)
  }
}
