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
  range = signal<Range>('day');
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
    if (!data) {
      console.log("⚠️ No data available for bar chart");
      return { labels: [], datasets: [] };
    }

    let topFoods: { name: string; count: number }[] = [];
    let colors: string[] = [];

    switch (status) {
      case 'expired':
        topFoods = data.topExpired || [];
        colors = ['#f56b6b', '#fbc1a7', '#f8a8a8']; // reds
        console.log("📊 Top Expired Foods:", topFoods);
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

    console.log(`📊 Raw ${status} foods:`, topFoods);

    // Sort by count descending and take top 3
    const sortedTopFoods = topFoods
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    console.log(`📊 Sorted top 3 ${status} foods:`, sortedTopFoods);

    const result = {
      labels: sortedTopFoods.map((i: any) => i.name),
      datasets: [{
        data: sortedTopFoods.map((i: any) => i.count),
        backgroundColor: colors.slice(0, sortedTopFoods.length)
      }]
    };

    console.log(`📊 Final bar chart data for ${status}:`, result);
    return result;
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

  // ✅ Get no data message based on selected status
  getNoDataMessage(): string {
    const status = this.selectedStatus();
    switch (status) {
      case 'expired':
        return 'Awesome!\n\nYou have no expired food.';
      case 'donated':
        return 'No donations yet.\n\nA great opportunity to help someone out!';
      case 'consumed':
        return 'No consumption activity recorded yet.\n\nYou\'re all set to start!';
      default:
        return 'No data available';
    }
  }

  // ✅ Get top food name based on selected status (the one with highest count/qty)
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

    if (topFoods.length === 0) return null;

    // Sort by count descending and get the first one (highest count/qty)
    const sorted = [...topFoods].sort((a, b) => b.count - a.count);
    return sorted[0]?.name || null;
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
        ticks: {
          stepSize: 1,
          callback: (value) => Number.isInteger(value) ? value : ''
        }
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
    this.api.getAnalytics(this.range()).subscribe({
      next: (res: AnalyticsData) => {
        console.log("📌 API returned:", res);
        console.log("📊 Top Expired:", res.topExpired);
        console.log("📊 Top Donated:", res.topDonated);
        console.log("📊 Top Consumed:", res.topConsumed);
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
        console.log("📊 Bar data after update:", this.currentBarData());

        this.loading.set(false);
      },
      error: (error) => {
        console.error("❌ Error loading analytics data:", error);
        this.loading.set(false);
      }
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
