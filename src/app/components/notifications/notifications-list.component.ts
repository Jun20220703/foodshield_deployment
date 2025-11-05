import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AppNotification, NotificationService } from '../../services/notification.service';
import { SidebarComponent } from "../sidebar/sidebar.component";
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-notifications-list',
  templateUrl: './notifications-list.component.html',
  styleUrls: ['./notifications-list.component.css'],
  imports: [SidebarComponent, CommonModule]
})
export class NotificationsListComponent implements OnInit {
  all: AppNotification[] = [];
  unread: AppNotification[] = [];
  read: AppNotification[] = [];
  activeTab: 'all' | 'unread' | 'read' = 'all';

  constructor(private ns: NotificationService, private router: Router) {}

  ngOnInit() {
    this.refresh();
    this.ns.notifications$.subscribe(() => this.refresh());
  }

  refresh() {
    const all = this.ns.getAll();
    this.all = all;
    this.unread = all.filter(n => !n.read);
    this.read = all.filter(n => n.read);
  }

  openDetail(n: AppNotification) {
    this.router.navigate(['/notifications', n.id]);
  }

  setTab(tab: 'all' | 'unread' | 'read') {
    this.activeTab = tab;
  }

  displayed(): AppNotification[] {
    if (this.activeTab === 'unread') return this.unread;
    if (this.activeTab === 'read') return this.read;
    return this.all;
  }

  badge(type: AppNotification['type']) {
    if (type === 'inventory') return 'Inventory';
    if (type === 'donation') return 'Donation';
    return 'Meal Plan';
  }
}
