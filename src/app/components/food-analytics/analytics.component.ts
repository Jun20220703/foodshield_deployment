// src/app/analytics/analytics.component.ts
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { AnalyticsService, AnalyticsData, Range } from '../../services/analytics.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { NgIf } from '@angular/common';


@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, BaseChartDirective, SidebarComponent, NgIf],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.css',
})
export class AnalyticsComponent implements OnInit {
  private api = inject(AnalyticsService);

  // Month / Year
  range = signal<Range>('month');
  loading = signal<boolean>(true);
  data = signal<AnalyticsData | null>(null);

  // header numbers
  consumed = computed(() => this.data()?.header.consumed ?? 0);
  donation = computed(() => this.data()?.header.donation ?? 0);
  expired  = computed(() => this.data()?.header.expired  ?? 0);

  // charts
  pieData = signal<ChartData<'pie'>>({ labels: [], datasets: [] });
  barData = signal<ChartData<'bar'>>({ labels: [], datasets: [] });

  pieOptions: ChartConfiguration<'pie'>['options'] = {
    responsive: true,
    plugins: { legend: { display: false } }
  };

  barOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { autoSkip: false } },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1 }
        }

    }
  };

  ngOnInit() { this.load(); }

  setRange(r: Range) {
    if (this.range() !== r) {
      this.range.set(r);
      this.load();
    }
  }

  private load() {
    this.loading.set(true);
    this.api.getAnalytics(this.range()).subscribe((res: AnalyticsData) => {
      this.data.set(res);

      // pie: Consumed / Donated / Expired
      this.pieData.set({
        labels: res.pie.labels,
        datasets: [{
          data: res.pie.values,
          // prototype colors
          backgroundColor: ['#8afc9e', '#fad46b', '#f56b6b'],
        }]
      });

      // bar: top expired foods
      this.barData.set({
        labels: res.topExpired.map(i => i.name),
        datasets: [{
          data: res.topExpired.map(i => i.count),
          backgroundColor: ['#f56b6b','#fbc1a7','#f8a8a8'] // soft reds like prototype
        }]
      });

      this.loading.set(false);
    });
  }
}
