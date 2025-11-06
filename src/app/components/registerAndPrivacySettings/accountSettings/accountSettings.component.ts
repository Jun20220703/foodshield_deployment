import { Component, ChangeDetectorRef, OnInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { SidebarComponent } from '../../sidebar/sidebar.component';

interface UserData {
  name: string;
  email: string;
  password: string;
  householdSize: string;
  dateOfBirth: string;
  profilePhoto?: string;
}

@Component({
  selector: 'app-account-settings',
  standalone: true,
  templateUrl: './accountSettings.component.html',
  styleUrls: ['./accountSettings.component.css'],
  imports: [CommonModule, FormsModule, HttpClientModule, SidebarComponent]
})
export class AccountSettingsComponent implements OnInit, OnDestroy {
  activeTab: 'account' | 'privacy' = 'account';
  
  userData: UserData = {
    name: '',
    email: '',
    password: '************',
    householdSize: 'No-Selection',
    dateOfBirth: '',
    profilePhoto: ''
  };

  // Store actual password for display
  actualPassword: string = '';

  // Profile photo properties
  selectedFile: File | null = null;
  profilePhotoPreview: string = '';


  // Password reset dialog states
  showPasswordResetDialog: boolean = false;
  showPasswordChangeForm: boolean = false;
  newPassword: string = '';
  confirmPassword: string = '';

  // Loading and error states
  isSaving: boolean = false;
  saveError: string = '';
  isLoadingUserData: boolean = true;
  
  // Password visibility state
  showPassword: boolean = false;
  showNewPassword: boolean = false;
  showConfirmPassword: boolean = false;

  // Two-Factor Authentication state
  twoFactorEnabled: boolean = false;
  showTwoFactorDialog: boolean = false;
  showTwoFactorDisableDialog: boolean = false;
  isEnablingTwoFactor: boolean = false;
  isWaitingForVerification: boolean = false;
  verificationCheckInterval: any = null;
  isEmailSent: boolean = false; // 이메일 발송 상태 추적
  isVerificationCompleted: boolean = false; // verification 완료 상태 추적

  // Email link access state
  showEmailLinkMessage: boolean = false;

  // 2FA Verification form state
  showVerificationForm: boolean = false;
  verificationCode: string = '';
  isVerifyingCode: boolean = false;
  verificationMessage: string = '';
  verificationSuccess: boolean = false;

  // Success message state
  showSuccessMessage: boolean = false;
  successMessage: string = '';

  // Custom alert modal state
  showCustomAlert: boolean = false;
  customAlertTitle: string = '';
  customAlertMessage: string = '';

  // 2FA Password Change Dialog state
  show2FAPasswordChangeDialog: boolean = false;
  twoFANewPassword: string = '';
  twoFAConfirmPassword: string = '';
  show2FANewPassword: boolean = false;
  show2FAConfirmPassword: boolean = false;
  isChanging2FAPassword: boolean = false;
  twoFAPasswordError: string = '';

  // Delete Account Dialog state
  showDeleteAccountDialog: boolean = false;
  deleteAccountPassword: string = '';
  showDeleteAccountPassword: boolean = false;
  isDeletingAccount: boolean = false;
  deleteAccountError: string = '';

  constructor(private router: Router, private route: ActivatedRoute, private http: HttpClient, private cdr: ChangeDetectorRef, private ngZone: NgZone) {}

  ngOnDestroy() {
    this.stopVerificationCheck();
    
    // Remove event listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageChange);
      window.removeEventListener('focus', this.handleWindowFocus);
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      window.removeEventListener('message', this.handlePostMessage);
    }
  }

  private handleWindowFocus = () => {
    console.log('Window focused - checking verification status');
    this.checkVerificationStatus();
  }

  private handleVisibilityChange = () => {
    if (!document.hidden) {
      console.log('Tab became visible - checking verification status');
      this.checkVerificationStatus();
    }
  }

  private handleStorageChange = (event: StorageEvent) => {
    console.log('Storage event detected:', event.key, event.newValue);
    if (event.key === '2faVerificationComplete' && event.newValue === 'true') {
      console.log('2FA verification complete detected from another tab');
      // Check verification status immediately (no delay)
      this.checkVerificationStatus();
    }
  }

  ngOnInit() {
    console.log('AccountSettingsComponent initialized');
    console.log('Initial showTwoFactorDialog:', this.showTwoFactorDialog);
    
    // Check URL parameters for tab selection
    this.route.queryParams.subscribe(params => {
      if (params['tab'] === 'privacy') {
        this.activeTab = 'privacy';
      }
    });
    
    // Load user data
    setTimeout(() => {
      this.loadUserData();
    }, 100);
    
    // Check for verification completion
    this.checkVerificationStatus();
    
    // Start periodic check for verification completion
    this.startVerificationCheck();
    
    // Listen for localStorage changes from other tabs
    this.setupLocalStorageListener();
    
    // Listen for window focus and visibility change events
    this.setupWindowEventListeners();
    
    // Listen for postMessage from other tabs
    this.setupPostMessageListener();
  }

  loadUserData() {
    this.isLoadingUserData = true;
    
    // SSR 호환성을 위한 localStorage 체크
    if (typeof window === 'undefined' || !window.localStorage) {
      this.isLoadingUserData = false;
      return;
    }
    
    const userId = localStorage.getItem('userId');
    console.log('loadUserData - userId:', userId);
    
    if (!userId) {
      alert('User not authenticated. Please log in again.');
      this.router.navigate(['/login']);
      this.isLoadingUserData = false;
      return;
    }

    // Always load fresh data from database to get latest profile photo
    console.log('Loading fresh user data from database...');
    this.http.get(`http://localhost:5001/api/users/profile/${userId}`)
      .subscribe({
        next: (response: any) => {
          console.log('Raw response from API:', response);
          
          this.userData = {
            name: response.name || '',
            email: response.email || '',
            password: '************',
            householdSize: response.householdSize || 'No-Selection',
            dateOfBirth: response.dateOfBirth ? new Date(response.dateOfBirth).toISOString().split('T')[0] : '',
            profilePhoto: response.profilePhoto || ''
          };
          
          // Set 2FA status from backend data
          this.twoFactorEnabled = response.twoFactorAuth?.isEnabled || false;
          console.log('2FA status loaded from backend:', this.twoFactorEnabled);
          
          // Load actual password from localStorage
          if (typeof window !== 'undefined' && window.localStorage) {
            this.actualPassword = localStorage.getItem('userPassword') || '';
          }
          
          this.isLoadingUserData = false;
          console.log('Loaded fresh user data from database:', this.userData);
          console.log('Profile photo from database:', response.profilePhoto);
          
          // Update localStorage with fresh data
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem('user', JSON.stringify(response));
          }
          
          // Force UI update
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Failed to load user data from database:', error);
          alert('Failed to load user data from database. Please check your connection and try again.');
          this.isLoadingUserData = false;
        }
      });
  }

  setActiveTab(tab: 'account' | 'privacy') {
    this.activeTab = tab;
    // Force UI update when switching tabs
    this.cdr.detectChanges();
  }


  clearField(fieldName: keyof UserData) {
    if (fieldName === 'householdSize') {
      this.userData[fieldName] = 'No-Selection';
    } else if (fieldName === 'password') {
      // Password field should not be cleared, just reset to masked value
      this.userData[fieldName] = '************';
    } else {
      this.userData[fieldName] = '';
    }
  }

  onCancel() {
    // Reset form data or navigate away
    this.router.navigate(['/home']);
  }

  onDeleteAccount() {
    // Show password confirmation dialog instead of simple confirm
    this.showDeleteAccountDialog = true;
    this.deleteAccountPassword = '';
    this.deleteAccountError = '';
    this.cdr.detectChanges();
  }

  onSave() {
    // Validate required fields
    if (!this.userData.name || !this.userData.dateOfBirth) {
      const missingFields = [];
      if (!this.userData.name) missingFields.push('Name');
      if (!this.userData.dateOfBirth) missingFields.push('Date of Birth');
      alert(`Please fill in all required fields: ${missingFields.join(', ')}`);
      return;
    }

    // Validate household size if provided
    if (this.userData.householdSize && this.userData.householdSize !== 'No-Selection') {
      const validValues = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10+'];
      if (!validValues.includes(this.userData.householdSize)) {
        alert('Please select a valid household size');
        return;
      }
    }

    // Confirm before saving
    const confirmed = confirm('Are you sure to save?');
    if (!confirmed) {
      this.isSaving = false;
      this.cdr.detectChanges();
      return;
    }

    this.isSaving = true;
    this.saveError = '';
    
    // Force UI update to show saving state immediately
    this.cdr.detectChanges();

    // Get user ID from localStorage (assuming it's stored there after login)
    if (typeof window === 'undefined' || !window.localStorage) {
      alert('User not authenticated. Please log in again.');
      this.router.navigate(['/login']);
      return;
    }
    const userId = localStorage.getItem('userId');
    if (!userId) {
      alert('User not authenticated. Please log in again.');
      this.isSaving = false;
      this.cdr.detectChanges();
      this.router.navigate(['/login']);
      return;
    }

    // Prepare data for API call
    const updateData = {
      name: this.userData.name,
      householdSize: (this.userData.householdSize === 'No-Selection' || this.userData.householdSize === null || this.userData.householdSize === undefined) ? null : this.userData.householdSize,
      dateOfBirth: this.userData.dateOfBirth,
      profilePhoto: this.profilePhotoPreview || this.userData.profilePhoto
    };

    console.log('Sending update data:', updateData);
    console.log('User ID:', userId);

    // Call the API
    this.http.put(`http://localhost:5001/api/users/profile/${userId}`, updateData)
      .subscribe({
        next: (response: any) => {
          console.log('Profile updated successfully:', response);
          this.isSaving = false;
          alert('Updates have been saved successfully');
          
          // Update local storage with new user data
          if (typeof window !== 'undefined' && window.localStorage && response.user) {
            localStorage.setItem('user', JSON.stringify(response.user));
          }
          
          // Force UI update to ensure buttons are re-enabled
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Profile update failed:', error);
          console.error('Error details:', {
            status: error.status,
            statusText: error.statusText,
            message: error.message,
            error: error.error
          });
          this.isSaving = false;
          
          let errorMessage = 'Failed to update profile';
          
          if (error.status === 0) {
            errorMessage = 'Cannot connect to server. Please check if the backend server is running.';
          } else if (error.status === 404) {
            errorMessage = 'User not found. Please log in again.';
          } else if (error.status === 500) {
            errorMessage = 'Server error. Please try again later.';
          } else if (error.error?.message) {
            errorMessage = error.error.message;
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          this.saveError = errorMessage;
          alert(`Failed to update profile: ${errorMessage}`);
          
          // Force UI update to ensure buttons are re-enabled even on error
          this.cdr.detectChanges();
        }
      });
  }

  // Password reset methods
  onPasswordClick() {
    this.showPasswordResetDialog = true;
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleNewPasswordVisibility() {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  onPasswordReset() {
    this.showPasswordResetDialog = true;
  }

  onPasswordResetCancel() {
    this.showPasswordResetDialog = false;
  }

  onPasswordResetConfirm() {
    this.showPasswordResetDialog = false;
    this.showPasswordChangeForm = true;
  }

  clearNewPassword() {
    this.newPassword = '';
  }

  clearConfirmPassword() {
    this.confirmPassword = '';
  }

  onPasswordChange() {
    if (this.newPassword && this.confirmPassword) {
      if (this.newPassword === this.confirmPassword) {
        // Check if new password is different from current password
        if (this.newPassword === this.actualPassword) {
          alert('New password must be different from your current password');
          return;
        }

        // Validate password strength
        if (this.newPassword.length < 8) {
          alert('Password must be at least 8 characters long');
          return;
        }

        const specialCharRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;
        if (!specialCharRegex.test(this.newPassword)) {
          alert('Password must contain at least one special character');
          return;
        }

        // Get user ID
        if (typeof window === 'undefined' || !window.localStorage) {
          alert('User not authenticated. Please log in again.');
          this.router.navigate(['/login']);
          return;
        }
        const userId = localStorage.getItem('userId');
        if (!userId) {
          alert('User not authenticated. Please log in again.');
          this.router.navigate(['/login']);
          return;
        }

        // Call password update API
        this.http.put(`http://localhost:5001/api/users/profile/${userId}`, {
          password: this.newPassword
        }).subscribe({
          next: (response: any) => {
            console.log('Password changed successfully');
            this.userData.password = '************';
            this.actualPassword = this.newPassword;
            // For security, clear auth state and force re-login with the new password
            this.showPasswordChangeForm = false;
            this.newPassword = '';
            this.confirmPassword = '';
            this.showNewPassword = false;
            this.showConfirmPassword = false;
            alert('Password changed successfully! Please log in again with your new password.');
            if (typeof window !== 'undefined' && window.localStorage) {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              localStorage.removeItem('userId');
              localStorage.removeItem('userPassword');
            }
            this.router.navigate(['/login']);
          },
          error: (error) => {
            console.error('Password change failed:', error);
            alert(`Failed to change password: ${error.error?.message || 'Unknown error'}`);
          }
        });
      } else {
        alert('Passwords do not match!');
      }
    } else {
      alert('Please fill in both password fields!');
    }
  }

  onPasswordChangeCancel() {
    this.showPasswordChangeForm = false;
    this.newPassword = '';
    this.confirmPassword = '';
    this.showNewPassword = false;
    this.showConfirmPassword = false;
  }

  // Profile photo upload methods
  onUploadPhoto() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = (event: any) => {
      const file = event.target.files[0];
      if (file) {
        this.handleFileSelect(file);
      }
    };
    fileInput.click();
  }

  handleFileSelect(file: File) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB.');
      return;
    }

    this.selectedFile = file;
    console.log('File selected:', file.name, 'Size:', file.size);

    // Show immediate preview first
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.profilePhotoPreview = e.target.result;
      console.log('Immediate preview set:', this.profilePhotoPreview);
      this.ngZone.run(() => {
        this.cdr.detectChanges();
      });
    };
    reader.readAsDataURL(file);

    // Then compress for better quality
    this.compressImage(file);
  }

  compressImage(file: File) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Set maximum dimensions
      const maxWidth = 800;
      const maxHeight = 800;
      
      let { width, height } = img;
      
      // Calculate new dimensions
      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
      }
      
      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      
      // Convert to base64 with compression (quality: 0.8)
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      this.profilePhotoPreview = compressedDataUrl;
      
      console.log(`Image compressed from ${file.size} bytes to ${compressedDataUrl.length} characters`);
      console.log('Profile photo preview set:', this.profilePhotoPreview);
      
      // Force UI update to show the preview immediately
      this.ngZone.run(() => {
        this.cdr.detectChanges();
      });
    };

    const reader = new FileReader();
    reader.onload = (e: any) => {
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  removeProfilePhoto() {
    this.selectedFile = null;
    this.profilePhotoPreview = '';
    this.userData.profilePhoto = '';
  }

  // Debug methods for image loading
  onImageError(event: any) {
    console.error('Image failed to load:', event);
    console.log('Current image src:', event.target.src);
    console.log('Profile photo data:', this.userData.profilePhoto);
    console.log('Profile photo preview:', this.profilePhotoPreview);
  }

  onImageLoad(event: any) {
    console.log('Image loaded successfully:', event.target.src);
  }

  // Two-Factor Authentication methods
  onTwoFactorToggleClick(event: Event) {
    event.preventDefault(); // 기본 동작 방지
    event.stopPropagation(); // 이벤트 전파 방지
    
    console.log('=== Two-Factor Toggle Click Event ===');
    console.log('Current twoFactorEnabled:', this.twoFactorEnabled);
    console.log('isVerificationCompleted:', this.isVerificationCompleted);
    
    // verification이 완료된 경우 다이얼로그를 표시하지 않음
    if (this.isVerificationCompleted) {
      console.log('Verification already completed, ignoring toggle click');
      return;
    }
    
    if (this.twoFactorEnabled === false) {
      // 토글을 켜려고 할 때
      console.log('🔄 Enabling 2FA - showing dialog');
      this.showTwoFactorDialog = true;
      // twoFactorEnabled는 아직 true로 설정하지 않음 (확인 후에 설정)
      
      // UI 강제 업데이트
      this.cdr.detectChanges();
      
      console.log('✅ Dialog should be visible now:', this.showTwoFactorDialog);
    } else {
      // 토글을 끄려고 할 때는 확인 다이얼로그 표시
      console.log('🔄 Disabling 2FA - showing disable dialog');
      this.showTwoFactorDisableDialog = true;
      this.cdr.detectChanges();
      console.log('✅ Disable dialog should be visible now');
    }
  }

  onTwoFactorToggle(newValue: boolean) {
    console.log('=== Two-Factor Toggle Event ===');
    console.log('New value:', newValue);
    console.log('Previous twoFactorEnabled:', this.twoFactorEnabled);
    console.log('Current showTwoFactorDialog:', this.showTwoFactorDialog);
    
    if (newValue === true) {
      // 토글을 켜려고 할 때
      console.log('🔄 Enabling 2FA - showing dialog');
      this.showTwoFactorDialog = true;
      this.twoFactorEnabled = true; // ngModelChange에서는 수동으로 설정해야 함
      
      // UI 강제 업데이트
      this.cdr.detectChanges();
      
      // 추가 확인을 위한 setTimeout
      setTimeout(() => {
        console.log('✅ After timeout - Dialog visible:', this.showTwoFactorDialog);
        console.log('✅ After timeout - Toggle enabled:', this.twoFactorEnabled);
      }, 100);
      
      console.log('✅ Dialog should be visible now:', this.showTwoFactorDialog);
    } else {
      // 토글을 끄려고 할 때는 먼저 토글을 원래 상태로 되돌리고 확인 다이얼로그 표시
      console.log('🔄 Disabling 2FA - reverting toggle and showing disable dialog');
      this.twoFactorEnabled = true; // 원래 상태로 되돌리기
      this.showTwoFactorDisableDialog = true;
      this.cdr.detectChanges();
      console.log('✅ Toggle reverted to ON, disable dialog should be visible now');
    }
  }

  onTwoFactorCancel() {
    // 취소 시 토글을 다시 끄기
    console.log('2FA cancelled, turning off toggle');
    this.twoFactorEnabled = false;
    this.showTwoFactorDialog = false;
    this.isEmailSent = false; // 이메일 발송 플래그 리셋
    this.isEnablingTwoFactor = false; // 진행 중 플래그도 리셋
    this.cdr.detectChanges();
    console.log('Toggle reset to OFF, dialog closed, email flags reset');
  }

  // 2FA 끄기 확인 다이얼로그 메서드들
  onTwoFactorDisableCancel() {
    // 취소 시 다이얼로그만 닫기 (토글은 ON 상태 유지)
    console.log('2FA disable cancelled - keeping toggle ON');
    this.showTwoFactorDisableDialog = false;
    // twoFactorEnabled는 이미 ON 상태이므로 변경하지 않음
    this.cdr.detectChanges();
  }

  onTwoFactorDisableConfirm() {
    // 2FA 끄기 확인
    console.log('2FA disable confirmed');
    
    const userId = localStorage.getItem('userId');
    if (!userId) {
      alert('User ID not found. Please log in again.');
      return;
    }
    
    // 백엔드 API 호출하여 2FA 비활성화
    this.http.post('http://localhost:5001/api/users/disable-2fa', {
      userId: userId
    }).subscribe({
      next: (response: any) => {
        console.log('2FA disabled successfully:', response);
        this.twoFactorEnabled = false;
        this.showTwoFactorDisableDialog = false;
        this.cdr.detectChanges();
        console.log('✅ 2FA disabled');
        
        // 성공 메시지 표시
        alert('Two-Factor Authentication has been disabled successfully.');
      },
      error: (error) => {
        console.error('Failed to disable 2FA:', error);
        alert('Failed to disable Two-Factor Authentication. Please try again.');
        this.showTwoFactorDisableDialog = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Resend verification link
  onResendVerificationLink() {
    console.log('Resending verification link to:', this.userData.email);
    
    // 백엔드 API 호출하여 새로운 verification 링크 발송
    this.http.post('http://localhost:5001/api/users/enable-2fa', {
      email: this.userData.email
    }).subscribe({
      next: (response: any) => {
        console.log('Verification link resent successfully:', response);
        alert('Verification link has been resent to your email!');
      },
      error: (error) => {
        console.error('Failed to resend verification link:', error);
        alert('Failed to resend verification link. Please try again.');
      }
    });
  }

  onTwoFactorConfirm() {
    // 중복 호출 방지
    if (this.isEnablingTwoFactor || this.isEmailSent) {
      console.log('2FA email already being sent or sent, ignoring duplicate request');
      return;
    }
    
    // 확인 시 이메일 발송
    console.log('2FA confirmed, sending email to:', this.userData.email);
    this.isEnablingTwoFactor = true;
    this.isEmailSent = true;
    this.cdr.detectChanges();
    
    // 백엔드 API 호출
    this.http.post('http://localhost:5001/api/users/enable-2fa', {
      email: this.userData.email
    }).subscribe({
      next: (response: any) => {
        console.log('2FA email sent successfully:', response);
        this.twoFactorEnabled = true; // 이제서야 true로 설정
        this.isEnablingTwoFactor = false;
        this.isWaitingForVerification = true;
        // 다이얼로그는 이미 열려있으므로 그대로 유지
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Failed to send 2FA email:', error);
        this.twoFactorEnabled = false; // 오류 시 false로 유지
        this.isEnablingTwoFactor = false;
        this.isEmailSent = false; // 오류 시 플래그 리셋
        this.showTwoFactorDialog = false;
        this.cdr.detectChanges();
        this.showCustomAlertModal('Error', 'Failed to send 2FA email. Please try again.');
      }
    });
  }

  // Email link access methods
  goToLogin() {
    this.router.navigate(['/login']);
  }

  dismissEmailMessage() {
    this.showEmailLinkMessage = false;
    this.cdr.detectChanges();
  }

  // 2FA Verification methods
  onVerifyCode() {
    if (!this.verificationCode || this.verificationCode.length !== 6) {
      this.verificationMessage = 'Please enter a valid 6-digit verification code.';
      this.verificationSuccess = false;
      return;
    }

    this.isVerifyingCode = true;
    this.verificationMessage = '';

    // Verify the code with backend
    this.http.post('http://localhost:5001/api/users/verify-2fa-code', {
      email: this.userData.email,
      verificationCode: this.verificationCode
    }).subscribe({
      next: (response: any) => {
        console.log('2FA verification successful:', response);
        this.isVerifyingCode = false;
        this.verificationSuccess = true;
        this.verificationMessage = 'Two-Factor Authentication has been successfully enabled!';
        this.showVerificationForm = false;
        
        // Show success message
        this.showSuccessModal('Verification is successful! Go back to your account');
        
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('2FA verification failed:', error);
        this.isVerifyingCode = false;
        this.verificationSuccess = false;
        this.verificationMessage = error.error?.message || 'Invalid verification code. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }


  onCancelVerification() {
    this.showVerificationForm = false;
    this.twoFactorEnabled = false;
    this.verificationCode = '';
    this.verificationMessage = '';
    this.cdr.detectChanges();
  }

  // Temporary login from email link
  performTemporaryLogin(token: string) {
    console.log('Performing temporary login with token:', token);
    
    this.http.get(`http://localhost:5001/api/users/temp-login/${token}`)
      .subscribe({
        next: (response: any) => {
          console.log('Temporary login successful:', response);
          
          // Set user data
          this.userData = {
            name: response.user.name || '',
            email: response.user.email || '',
            password: '************',
            householdSize: response.user.householdSize || 'No-Selection',
            dateOfBirth: response.user.dateOfBirth ? new Date(response.user.dateOfBirth).toISOString().split('T')[0] : '',
            profilePhoto: response.user.profilePhoto || ''
          };
          
          // Store in localStorage for this session
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem('user', JSON.stringify(response.user));
            localStorage.setItem('userId', response.user.id);
          }
          
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Temporary login failed:', error);
          this.verificationMessage = 'Invalid or expired link. Please try again.';
          this.verificationSuccess = false;
          this.showVerificationForm = false;
          this.cdr.detectChanges();
        }
      });
  }

  // Show success message
  showSuccessModal(message: string) {
    this.successMessage = message;
    this.showSuccessMessage = true;
    this.cdr.detectChanges();
  }

  onSuccessClose() {
    this.showSuccessMessage = false;
    this.cdr.detectChanges();
  }

  // Cancel verification waiting state
  onCancelVerificationWaiting() {
    console.log('Cancelling 2FA verification for:', this.userData.email);
    
    // 백엔드에 verification 취소 요청하여 링크 무효화
    this.http.post('http://localhost:5001/api/users/cancel-2fa-verification', {
      email: this.userData.email
    }).subscribe({
      next: (response: any) => {
        console.log('2FA verification cancelled successfully:', response);
        
        // UI 업데이트
        this.isWaitingForVerification = false;
        this.twoFactorEnabled = false;
        this.showTwoFactorDialog = false;
        this.isEmailSent = false; // 이메일 발송 플래그 리셋
        this.isEnablingTwoFactor = false; // 진행 중 플래그도 리셋
        
        // 취소 메시지를 alert로 표시 (성공 메시지와 충돌하지 않도록)
        if (!this.showSuccessMessage) {
          alert('Enabling 2FA is cancelled');
        }
        
        this.cdr.detectChanges();
        console.log('2FA verification cancelled - UI updated, email flags reset');
      },
      error: (error) => {
        console.error('Failed to cancel 2FA verification:', error);
        
        // 오류가 발생해도 UI는 업데이트
        this.isWaitingForVerification = false;
        this.twoFactorEnabled = false;
        this.showTwoFactorDialog = false;
        this.isEmailSent = false;
        this.isEnablingTwoFactor = false;
        
        // 취소 메시지를 alert로 표시 (성공 메시지와 충돌하지 않도록)
        if (!this.showSuccessMessage) {
          alert('Enabling 2FA is cancelled');
        }
        
        this.cdr.detectChanges();
        console.log('2FA verification cancelled - UI updated despite error');
      }
    });
  }

  // Check verification status
  checkVerificationStatus() {
    if (typeof window !== 'undefined' && window.localStorage) {
      const verificationComplete = localStorage.getItem('2faVerificationComplete');
      const activationSuccess = localStorage.getItem('2faActivationSuccess');
      const verificationTimestamp = localStorage.getItem('2faVerificationTimestamp');
      
      console.log('=== CHECKING VERIFICATION STATUS ===');
      console.log('verificationComplete:', verificationComplete);
      console.log('activationSuccess:', activationSuccess);
      console.log('verificationTimestamp:', verificationTimestamp);
      console.log('Current isWaitingForVerification:', this.isWaitingForVerification);
      console.log('Current showTwoFactorDialog:', this.showTwoFactorDialog);
      console.log('Current isVerificationCompleted:', this.isVerificationCompleted);
      
      // localStorage의 모든 키 확인
      console.log('All localStorage keys:', Object.keys(localStorage));
      
      // activationSuccess가 true이면 verification이 완료된 것으로 간주
      if (verificationComplete === 'true' || activationSuccess === 'true') {
        console.log('Verification complete detected, processing...');
        
        // Clear the flags immediately to prevent duplicate processing
        localStorage.removeItem('2faVerificationComplete');
        localStorage.removeItem('2faActivationSuccess');
        localStorage.removeItem('2faVerificationTimestamp');
        
        // Hide waiting state and dialog immediately
        this.ngZone.run(() => {
          this.isWaitingForVerification = false;
          this.showTwoFactorDialog = false;
          this.isVerificationCompleted = true; // verification 완료 플래그 설정
          
          console.log('Dialog states reset - isWaitingForVerification:', this.isWaitingForVerification, 'showTwoFactorDialog:', this.showTwoFactorDialog, 'isVerificationCompleted:', this.isVerificationCompleted);
          
          // 강제로 change detection 실행
          this.cdr.detectChanges();
        });
        
        // Reload user data to get updated 2FA status
        this.loadUserData();
        
        // Show success message if activation was successful
        if (activationSuccess === 'true') {
          console.log('Showing activation success message');
          
          // Clear any existing success message first
          this.showSuccessMessage = false;
          this.successMessage = '';
          
          // Immediately show the activation success message (no delay)
          this.showSuccessMessage = true;
          this.successMessage = '🔐 Two-Factor Authentication has been successfully enabled! Please set up your new password to complete the security setup.';
          
          // Show 2FA password change dialog after a short delay
          setTimeout(() => {
            this.open2FAPasswordChangeDialog();
            console.log('2FA password change dialog shown');
          }, 3000); // 3초 후에 비밀번호 변경 다이얼로그 표시
        }
        
        this.cdr.detectChanges();
        console.log('Verification status updated - isWaitingForVerification:', this.isWaitingForVerification);
        console.log('Verification status updated - showTwoFactorDialog:', this.showTwoFactorDialog);
      }
    }
  }

  // Start periodic verification check
  startVerificationCheck() {
    this.verificationCheckInterval = setInterval(() => {
      this.checkVerificationStatus();
    }, 200); // Check every 200ms for faster response
  }

  // Stop verification check
  stopVerificationCheck() {
    if (this.verificationCheckInterval) {
      clearInterval(this.verificationCheckInterval);
      this.verificationCheckInterval = null;
    }
  }

  // Setup localStorage listener for cross-tab communication
  setupLocalStorageListener() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.handleStorageChange);
    }
  }

  // Setup window event listeners for tab focus and visibility changes
  setupWindowEventListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', this.handleWindowFocus);
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }
  }

  // Setup postMessage listener for cross-tab communication
  setupPostMessageListener() {
    if (typeof window !== 'undefined') {
      window.addEventListener('message', this.handlePostMessage);
    }
  }

  private handlePostMessage = (event: MessageEvent) => {
    console.log('PostMessage received:', event.data);
    if (event.data && event.data.type === '2FA_VERIFICATION_COMPLETE') {
      console.log('2FA verification complete message received from other tab');
      this.checkVerificationStatus();
    }
  }

  // Custom alert modal methods
  showCustomAlertModal(title: string, message: string) {
    this.customAlertTitle = title;
    this.customAlertMessage = message;
    this.showCustomAlert = true;
    this.cdr.detectChanges();
  }

  onCustomAlertClose() {
    this.showCustomAlert = false;
    this.cdr.detectChanges();
  }

  // 2FA Password Change methods
  toggle2FANewPasswordVisibility() {
    this.show2FANewPassword = !this.show2FANewPassword;
  }

  toggle2FAConfirmPasswordVisibility() {
    this.show2FAConfirmPassword = !this.show2FAConfirmPassword;
  }

  clear2FANewPassword() {
    this.twoFANewPassword = '';
  }

  clear2FAConfirmPassword() {
    this.twoFAConfirmPassword = '';
  }

  on2FAPasswordChange() {
    // Clear previous error
    this.twoFAPasswordError = '';

    // Validate inputs
    if (!this.twoFANewPassword || !this.twoFAConfirmPassword) {
      this.twoFAPasswordError = 'Please fill in both password fields.';
      return;
    }

    if (this.twoFANewPassword !== this.twoFAConfirmPassword) {
      this.twoFAPasswordError = 'Passwords do not match.';
      return;
    }

    // Check if new password is different from current password
    if (this.twoFANewPassword === this.actualPassword) {
      this.twoFAPasswordError = 'New password must be different from your current password.';
      return;
    }

    // Validate password strength
    if (this.twoFANewPassword.length < 8) {
      this.twoFAPasswordError = 'Password must be at least 8 characters long.';
      return;
    }

    const specialCharRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/;
    if (!specialCharRegex.test(this.twoFANewPassword)) {
      this.twoFAPasswordError = 'Password must contain at least one special character.';
      return;
    }

    // Get user ID
    if (typeof window === 'undefined' || !window.localStorage) {
      this.twoFAPasswordError = 'User not authenticated. Please log in again.';
      return;
    }
    const userId = localStorage.getItem('userId');
    if (!userId) {
      this.twoFAPasswordError = 'User not authenticated. Please log in again.';
      return;
    }

    this.isChanging2FAPassword = true;
    this.cdr.detectChanges();

    // Call password update API
    this.http.put(`http://localhost:5001/api/users/profile/${userId}`, {
      password: this.twoFANewPassword
    }).subscribe({
      next: (response: any) => {
        console.log('2FA password changed successfully');
        this.isChanging2FAPassword = false;
        
        // Close the dialog
        this.show2FAPasswordChangeDialog = false;
        this.twoFANewPassword = '';
        this.twoFAConfirmPassword = '';
        this.show2FANewPassword = false;
        this.show2FAConfirmPassword = false;
        this.twoFAPasswordError = '';
        
        // Update local password
        this.actualPassword = this.twoFANewPassword;
        this.userData.password = '************';
        
        // Update localStorage with new password
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem('userPassword', this.twoFANewPassword);
        }
        
        // Show success message and redirect to login
        this.showSuccessMessage = true;
        this.successMessage = '🎉 Two-Factor Authentication setup completed successfully! For security reasons, please log in again with your new password.';
        
        this.cdr.detectChanges();
        
        // Clear all authentication data and redirect to login after showing success message
        setTimeout(() => {
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('userId');
            localStorage.removeItem('userPassword');
            localStorage.removeItem('2faVerificationComplete');
            localStorage.removeItem('2faActivationSuccess');
            localStorage.removeItem('2faVerificationTimestamp');
          }
          
          // Redirect to login page
          this.router.navigate(['/login']);
        }, 3000); // 3초 후에 로그인 페이지로 리다이렉트
      },
      error: (error) => {
        console.error('2FA password change failed:', error);
        this.isChanging2FAPassword = false;
        this.twoFAPasswordError = error.error?.message || 'Failed to change password. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }

  // Show 2FA password change dialog
  open2FAPasswordChangeDialog() {
    this.show2FAPasswordChangeDialog = true;
    this.twoFANewPassword = '';
    this.twoFAConfirmPassword = '';
    this.show2FANewPassword = false;
    this.show2FAConfirmPassword = false;
    this.twoFAPasswordError = '';
    this.cdr.detectChanges();
  }

  // Delete Account Dialog methods
  onDeleteAccountCancel() {
    this.showDeleteAccountDialog = false;
    this.deleteAccountPassword = '';
    this.deleteAccountError = '';
    this.cdr.detectChanges();
  }

  toggleDeleteAccountPasswordVisibility() {
    this.showDeleteAccountPassword = !this.showDeleteAccountPassword;
  }

  clearDeleteAccountPassword() {
    this.deleteAccountPassword = '';
  }

  onDeleteAccountConfirm() {
    // Clear previous error
    this.deleteAccountError = '';

    // Validate password input
    if (!this.deleteAccountPassword) {
      this.deleteAccountError = 'Please enter your current password to confirm account deletion.';
      return;
    }

    // Verify password matches current password
    if (this.deleteAccountPassword !== this.actualPassword) {
      this.deleteAccountError = 'Incorrect password. Please enter your current password.';
      return;
    }

    // Get user ID
    if (typeof window === 'undefined' || !window.localStorage) {
      this.deleteAccountError = 'User not authenticated. Please log in again.';
      return;
    }
    
    const userId = localStorage.getItem('userId');
    if (!userId) {
      this.deleteAccountError = 'User not authenticated. Please log in again.';
      return;
    }

    this.isDeletingAccount = true;
    this.cdr.detectChanges();

    // Call delete account API
    this.http.delete(`http://localhost:5001/api/users/profile/${userId}`)
      .subscribe({
        next: (response: any) => {
          console.log('Account deleted successfully:', response);
          this.isDeletingAccount = false;
          
          // Clear all user data from localStorage
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('userId');
            localStorage.removeItem('userPassword');
            localStorage.removeItem('2faVerificationComplete');
            localStorage.removeItem('2faActivationSuccess');
            localStorage.removeItem('2faVerificationTimestamp');
          }
          
          // Close dialog and show success message
          this.showDeleteAccountDialog = false;
          this.deleteAccountPassword = '';
          this.deleteAccountError = '';
          
          // Show success message and redirect to login
          alert('Your account has been successfully deleted. You will be redirected to the login page.');
          this.router.navigate(['/login']);
        },
        error: (error) => {
          console.error('Account deletion failed:', error);
          this.isDeletingAccount = false;
          
          let errorMessage = 'Failed to delete account';
          
          if (error.status === 0) {
            errorMessage = 'Cannot connect to server. Please check if the backend server is running.';
          } else if (error.status === 404) {
            errorMessage = 'User not found. Please log in again.';
          } else if (error.status === 500) {
            errorMessage = 'Server error. Please try again later.';
          } else if (error.error?.message) {
            errorMessage = error.error.message;
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          this.deleteAccountError = errorMessage;
          this.cdr.detectChanges();
        }
      });
  }
}
