// src/app/analytics/analytics.component.ts
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, Chart, registerables } from 'chart.js';
Chart.register(...registerables); // ✅ important!!
import { AnalyticsService, AnalyticsData, Range } from '../../services/analytics.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { NgIf } from '@angular/common';

// Helper function to darken a hex or rgba color
function darkenColor(color: string, percent: number): string {
  // Handle rgba colors
  if (color.startsWith('rgba')) {
    const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbaMatch) {
      const r = Math.max(0, Math.floor(parseInt(rgbaMatch[1]) * (1 - percent)));
      const g = Math.max(0, Math.floor(parseInt(rgbaMatch[2]) * (1 - percent)));
      const b = Math.max(0, Math.floor(parseInt(rgbaMatch[3]) * (1 - percent)));
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  
  // Handle hex colors
  const hex = color.replace('#', '');
  const num = parseInt(hex, 16);
  const r = Math.max(0, Math.floor((num >> 16) * (1 - percent)));
  const g = Math.max(0, Math.floor(((num >> 8) & 0x00FF) * (1 - percent)));
  const b = Math.max(0, Math.floor((num & 0x0000FF) * (1 - percent)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Plugin to display labels and percentages inside pie chart segments
const pieLabelsPlugin = {
  id: 'pieLabels',
  afterDraw: (chart: Chart) => {
    const ctx = chart.ctx;
    const dataset = chart.data.datasets[0];
    const labels = chart.data.labels as string[];
    const data = dataset.data as number[];
    const colors = dataset.backgroundColor as string[];
    
    if (!data || data.length === 0) return;
    
    const total = data.reduce((a, b) => a + b, 0);
    if (total === 0) return;
    
    chart.getDatasetMeta(0).data.forEach((arc: any, index: number) => {
      const model = arc;
      const angle = model.startAngle + (model.endAngle - model.startAngle) / 2;
      
      // Position labels in the center of each segment
      const x = model.x + Math.cos(angle) * (model.innerRadius + (model.outerRadius - model.innerRadius) / 2);
      const y = model.y + Math.sin(angle) * (model.innerRadius + (model.outerRadius - model.innerRadius) / 2);
      
      const value = data[index];
      const percentage = ((value / total) * 100).toFixed(1);
      let label = labels[index] || '';
      
      // Map labels to proper display names
      const labelMap: { [key: string]: string } = {
        'consumed': 'Consumed',
        'donated': 'Donation',
        'expired': 'Expired'
      };
      
      // Use mapped label or capitalize first letter
      label = labelMap[label.toLowerCase()] || label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
      
      // Get the original segment color (use original colors to avoid rgba issues)
      // Original colors: ['#8afc9e', '#fad46b', '#f56b6b'] for Consumed, Donated, Expired
      const originalColors = ['#8afc9e', '#fad46b', '#f56b6b'];
      const segmentColor = originalColors[index] || colors[index] || '#333';
      const darkerColor = darkenColor(segmentColor, 0.5); // Darken by 50% for better visibility
      
      ctx.save();
      ctx.fillStyle = darkerColor;
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Display label and percentage together
      ctx.fillText(`${label} ${percentage}%`, x, y);
      
      ctx.restore();
    });
  }
};

Chart.register(pieLabelsPlugin);


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
  
  // Store original pie chart colors for hover effects
  private originalPieColors: string[] = ['#8afc9e', '#fad46b', '#f56b6b']; // Consumed, Donated, Expired

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
    plugins: { 
      legend: { display: false },
      tooltip: { 
        enabled: true,
        callbacks: {
          label: (context) => {
            const label = context.label || '';
            const value = context.parsed || 0;
            // Map labels to proper display names
            const labelMap: { [key: string]: string } = {
              'consumed': 'Consumed',
              'donated': 'Donation',
              'expired': 'Expired'
            };
            const displayLabel = labelMap[label.toLowerCase()] || label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
            return `${displayLabel}: ${value}`;
          }
        }
      }
    },
    onHover: (event, activeElements, chart) => {
      const dataset = chart?.data?.datasets?.[0];
      if (!dataset || !this.originalPieColors.length) return;
      
      if (activeElements.length > 0) {
        const hoveredIndex = activeElements[0].index;
        
        // Create new colors array with transparency for non-hovered segments
        const newColors = this.originalPieColors.map((color, index) => {
          if (index === hoveredIndex) {
            return color; // Keep original color for hovered segment
          } else {
            return this.addTransparency(color, 0.7); // 30% opacity for others
          }
        });
        
        dataset.backgroundColor = newColors;
        chart.update('none'); // Update without animation for smooth hover
      } else {
        // Restore original colors when not hovering
        dataset.backgroundColor = [...this.originalPieColors];
        chart.update('none');
      }
    }
  };
  
  // Helper function to add transparency to hex color
  private addTransparency(hex: string, opacity: number): string {
    // Remove # if present
    const cleanHex = hex.replace('#', '');
    
    // Convert hex to RGB
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    
    // Return rgba string
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }

  barOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { autoSkip: false } },
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 2,
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
        // Store original colors
        this.originalPieColors = ['#8afc9e', '#fad46b', '#f56b6b'];
        this.pieData.set({
          labels: res.pie.labels,
          datasets: [{
            data: res.pie.values,
            // prototype colors
            backgroundColor: [...this.originalPieColors],
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

  // ✅ Check if pie chart has data
  hasPieData(): boolean {
    const data = this.pieData();
    if (!data.datasets || data.datasets.length === 0) return false;
    const values = data.datasets[0].data as number[];
    if (!values || values.length === 0) return false;
    // Check if all values are 0 or if sum is 0
    return values.some(val => val > 0);
  }

  // ✅ Get no data message for pie chart
  getPieNoDataMessage(): string {
    return 'No activity to show yet 🌼\n\nAdd or update your food items to see your progress!';
  }

  // ✅ Get pie chart title based on range
  getPieChartTitle(): string {
    return this.range() === 'day' 
      ? '🌞 Today\'s Food Activity Breakdown' 
      : '📅 Monthly Food Activity Breakdown';
  }
}
