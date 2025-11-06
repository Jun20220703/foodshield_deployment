import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type Range = 'month' | 'year';

export interface AnalyticsData {
  header: {
    consumed: number;
    expired: number;
    donation: number;
  };
  pie: {
    labels: string[];
    values: number[];
  };
  topExpired: { name: string; count: number }[];
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private baseUrl = '/api/analytics';

  constructor(private http: HttpClient) {}

  getAnalytics(range: Range): Observable<AnalyticsData> {
    return this.http.get<AnalyticsData>(`${this.baseUrl}/${range}`);
  }
}
