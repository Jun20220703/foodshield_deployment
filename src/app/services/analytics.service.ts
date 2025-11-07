import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type Range = 'day' | 'month';

export interface AnalyticsData {
  header: {
    consumed: number;
    donation: number;
    expired: number;
  };
  pie: {
    labels: string[];
    values: number[];
  };
  topExpired: { name: string; count: number }[];
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:5001/api/analytics';

  getAnalytics(range: Range): Observable<AnalyticsData> {
    const token = localStorage.getItem('token');

    const endpoint = range === 'day'
      ? 'daily'
      : 'monthly';

    return this.http.get<AnalyticsData>(
      `http://localhost:5001/api/analytics/${endpoint}`,
      {
        headers: { Authorization: `Bearer ${token}` }  // ✅ 加上 Bearer 前缀
      }
    );
  }




}
