import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type NotificationType = 'inventory' | 'donation' | 'meal';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly _all = new BehaviorSubject<AppNotification[]>([
    {
      id: '1',
      type: 'inventory',
      title: 'Milk is expiring tomorrow',
      message: 'Your milk will expire on 12 Sep 2025. Use it soon or consider donating.',
      createdAt: '2025-09-12T09:00:00',
      read: false
    },
    {
      id: '2',
      type: 'donation',
      title: 'Your donation of 2kg rice was claimed',
      message:
        'Your donation of 2kg Rice has been successfully claimed. Pickup is arranged for 13 Sep 2025 at 2 PM.\n\nThank you for contributing!\n– SavePlate Team',
      createdAt: '2025-09-11T10:45:00',
      read: false
    },
    {
      id: '3',
      type: 'meal',
      title: 'Reminder: Dinner planned tonight',
      message: 'Meal plan reminder: Dinner at 7PM – Pasta with vegetables.',
      createdAt: '2025-09-10T20:00:00',
      read: true
    }
  ]);

  notifications$ = this._all.asObservable();

  getAll() {
    return [...this._all.value].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  getById(id: string) {
    return this._all.value.find(n => n.id === id);
  }

  markAsRead(id: string) {
    const arr = this._all.value.map(n =>
      n.id === id ? { ...n, read: true } : n
    );
    this._all.next(arr);
  }
}
