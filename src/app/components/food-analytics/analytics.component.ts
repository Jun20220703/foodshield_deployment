// src/app/analytics/analytics.component.ts
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, Chart, registerables } from 'chart.js';
Chart.register(...registerables); // ✅ important!!
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

  // ✅ new line for clickable tags (Expired / Donated / Consumed)
  selectedStatus = signal<'expired' | 'donated' | 'consumed'>('expired');

  // header numbers
  consumed = computed(() => this.data()?.header.consumed ?? 0);
  donation = computed(() => this.data()?.header.donation ?? 0);
  expired  = computed(() => this.data()?.header.expired  ?? 0);

  // charts
  pieData = signal<ChartData<'pie'>>({ labels: [], datasets: [] });
  barData = signal<ChartData<'bar'>>({ labels: [], datasets: [] });

  // ✅ Computed bar data based on selected status
  currentBarData = computed(() => {
    const status = this.selectedStatus();
    const data = this.data();
    if (!data) return { labels: [], datasets: [] };

    let topFoods: { name: string; count: number }[] = [];
    let colors: string[] = [];

    switch (status) {
      case 'expired':
        topFoods = data.topExpired || [];
        colors = ['#f56b6b', '#fbc1a7', '#f8a8a8']; // reds
        break;
      case 'donated':
        topFoods = data.topDonated || [];
        colors = ['#fad46b', '#fce8a3', '#fdf4d3']; // yellows
        break;
      case 'consumed':
        topFoods = data.topConsumed || [];
        colors = ['#8afc9e', '#b8fcc8', '#d4fde0']; // greens
        break;
    }

    return {
      labels: topFoods.map((i: any) => i.name),
      datasets: [{
        data: topFoods.map((i: any) => i.count),
        backgroundColor: colors
      }]
    };
  });

  // ✅ Get title based on selected status
  getBarTitle(): string {
    const status = this.selectedStatus();
    switch (status) {
      case 'expired':
        return 'Top Expired Food';
      case 'donated':
        return 'Top Donated Food';
      case 'consumed':
        return 'Top Consumed Food';
      default:
        return 'Top Expired Food';
    }
  }

  // ✅ Get top food name based on selected status
  getTopFoodName(): string | null {
    const status = this.selectedStatus();
    const data = this.data();
    if (!data) return null;

    let topFoods: { name: string; count: number }[] = [];
    switch (status) {
      case 'expired':
        topFoods = data.topExpired || [];
        break;
      case 'donated':
        topFoods = data.topDonated || [];
        break;
      case 'consumed':
        topFoods = data.topConsumed || [];
        break;
    }

    return topFoods[0]?.name || null;
  }

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
      console.log("📌 API returned:", res);   // ✅ 加这一行
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

      // bar: will be updated by currentBarData computed property
      this.updateBarData();

      this.loading.set(false);
    });
  }

  // ✅ Update bar data when status changes
  updateBarData() {
    this.barData.set(this.currentBarData());
  }

  // ✅ Handle status change
  onStatusChange(status: 'expired' | 'donated' | 'consumed') {
    this.selectedStatus.set(status);
    this.updateBarData();
  }
}
