import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';

export type Range = 'month' | 'year';

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

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {

  // ✅ Mock data for "Month" view (matches your UI)
  private monthData: AnalyticsData = {
    header: { consumed: 34, donation: 16, expired: 5 },
    pie: {
      labels: ['Consumed', 'Donated', 'Expired'],
      values: [61.8, 29.1, 9.1]   // percentages
    },
    topExpired: [
      { name: 'Coriander', count: 3 },
      { name: 'Dragon Fruit', count: 1 },
      { name: 'Galgol', count: 1 }
    ]
  };

  // ✅ Mock data for "Year" view (placeholder sample)
  private yearData: AnalyticsData = {
    header: { consumed: 276, donation: 103, expired: 31 },
    pie: {
      labels: ['Consumed', 'Donated', 'Expired'],
      values: [66, 25, 9]
    },
    topExpired: [
      { name: 'Coriander', count: 20 },
      { name: 'Milk', count: 11 },
      { name: 'Strawberry', count: 8 }
    ]
  };

  constructor() {}

  /** Get analytics data by selected range */
  getAnalytics(range: Range): Observable<AnalyticsData> {
    const data = range === 'month' ? this.monthData : this.yearData;
    return of(data).pipe(delay(200)); // simulate slight loading
  }
}
