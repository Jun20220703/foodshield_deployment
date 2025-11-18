import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Subject } from 'rxjs';

// 通知データ型
export interface Notification {
  _id?: string;
  type: string;
  title: string;
  message: string;
  createdAt?: Date;
  read: boolean;
  userId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private apiUrl = 'http://localhost:5001/api/notifications';

  // 🔴 サイドバー更新イベント（未読数の自動反映用）
  private notifyUpdateSource = new Subject<void>();
  notifyUpdate$ = this.notifyUpdateSource.asObservable(); 

  constructor(private http: HttpClient) {}

   // 🔴 サイドバーに「通知が変わったよ！」と知らせる用
  triggerNotificationUpdate() {
    this.notifyUpdateSource.next();
  }
  // ✅ ログインユーザーの通知だけ取得
  getNotifications(): Observable<Notification[]> {
    const userId = localStorage.getItem('userId'); // ローカルストレージから取得
    if (!userId) {
      console.warn('User ID not found in localStorage');
      return new Observable<Notification[]>((observer) => {
        observer.next([]); // 空配列返して安全に終了
        observer.complete();
      });
    }

    // /api/notifications?userId=xxx 形式でリクエスト
    return this.http.get<Notification[]>(`${this.apiUrl}?userId=${userId}`);
  }

  // 通知を作成
  addNotification(notification: Notification): Observable<Notification> {
    return this.http.post<Notification>(this.apiUrl, notification);
  }

  // 通知を既読に更新
  markAsRead(id: string): Observable<Notification> {
    return this.http.patch<Notification>(`${this.apiUrl}/${id}/read`, {});
  }

  // 通知を削除
  deleteNotification(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  // 通知を1件取得（idで検索）
  getById(id: string): Observable<Notification> {
    const userId = localStorage.getItem('userId');
    console.log('🟢 バックエンドへ送信:', `${this.apiUrl}/${id}?userId=${userId}`);
    return this.http.get<Notification>(`${this.apiUrl}/${id}?userId=${userId}`);
  }

  checkExpiry(userId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/check-expiry`, { userId });
  }

}
