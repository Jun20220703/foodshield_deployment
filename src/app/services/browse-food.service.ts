import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';

export interface Food {
  _id?: string;
  name: string;
  qty: number;
  expiry: string;
  category: string;
  storage: string;
  notes?: string;
  status?: 'inventory' | 'donation' | 'expired'; // ✅ 加入 expired
  owner?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BrowseFoodService {
  private apiUrl = 'http://localhost:5001/api/foods';
  private donationsUrl = 'http://localhost:5001/api/donations';

  // ⭐新增：注入 PLATFORM_ID
  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  getFoods(): Observable<Food[]> {
    let userId = '';

    // ⭐只在浏览器端取 localStorage
    if (isPlatformBrowser(this.platformId)) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      userId = user.id || '';
    }

    return this.http.get<Food[]>(`${this.apiUrl}?userId=${userId}`);
  }

  getDonations(): Observable<any[]> {
    let userId = '';

    if (isPlatformBrowser(this.platformId)) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      userId = user.id || '';
    }

    return this.http.get<any[]>(`${this.donationsUrl}?userId=${userId}`);
  }

  /** 更新食物状态（Donate / Inventory / Expired） */
  updateFoodStatus(id: string, status: 'inventory' | 'donation' | 'expired'): Observable<any> {
    return this.http.patch(`${this.apiUrl}/${id}/status`, { status });
  }

  /** 更新食物数量（Used / Meal） */
  updateFoodQty(id: string, newQty: number): Observable<any> {
    console.log("🟢 updateFoodQty id:", id, "newQty:", newQty);
    return this.http.put(`${this.apiUrl}/${id}`, { qty: newQty });
  }
}
