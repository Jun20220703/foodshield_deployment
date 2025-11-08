import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
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
  topExpired: {
    name: string;
    count: number;
  }[];
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private apiUrl = 'http://localhost:5001/api/analytics';

  constructor(private http: HttpClient) {}

  getAnalytics(range: Range): Observable<AnalyticsData> {
    const token = localStorage.getItem('token') ?? '';
    const headers = new HttpHeaders({ 'Authorization': `Bearer ${token}` });

    return this.http.get<AnalyticsData>(`${this.apiUrl}/daily`, { headers });
  }
}
