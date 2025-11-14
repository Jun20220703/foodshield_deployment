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
  status?: 'inventory' | 'donation' | 'expired' | 'consumed'; // ✅ 包含所有状态
  owner?: string;
}

export interface MarkedFood {
  _id?: string;
  foodId: string;
  qty: number;
  name: string;
  category: string;
  storage: string;
  expiry: string;
  notes?: string;
  owner?: string;
  createdAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class BrowseFoodService {
  private apiUrl = 'http://localhost:5001/api/foods';
  private donationsUrl = 'http://localhost:5001/api/donations';
  private markedFoodsUrl = 'http://localhost:5001/api/marked-foods';

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
      userId = user.id || user._id || '';
    }

    return this.http.get<Food[]>(`${this.apiUrl}?userId=${userId}`);
  }

  getDonations(): Observable<any[]> {
    let userId = '';

    if (isPlatformBrowser(this.platformId)) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      userId = user.id || user._id || '';
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

  /** Mark food - Save marked food to database */
  markFood(markedFoodData: MarkedFood): Observable<MarkedFood> {
    let userId = '';
    if (isPlatformBrowser(this.platformId)) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      userId = user.id || user._id || '';
    }
    return this.http.post<MarkedFood>(this.markedFoodsUrl, {
      ...markedFoodData,
      owner: userId
    });
  }

  /** Get marked foods for current user */
  getMarkedFoods(): Observable<MarkedFood[]> {
    let userId = '';
    if (isPlatformBrowser(this.platformId)) {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      userId = user.id || user._id || '';
    }
    return this.http.get<MarkedFood[]>(`${this.markedFoodsUrl}?userId=${userId}`);
  }

  /** Delete marked food */
  deleteMarkedFood(id: string): Observable<any> {
    return this.http.delete(`${this.markedFoodsUrl}/${id}`);
  }

  /** Update marked food quantity */
  updateMarkedFoodQty(id: string, qty: number): Observable<MarkedFood> {
    return this.http.patch<MarkedFood>(`${this.markedFoodsUrl}/${id}`, { qty });
  }

  /** Delete food */
  deleteFood(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
