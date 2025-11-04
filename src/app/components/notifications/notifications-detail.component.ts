import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AppNotification, NotificationService } from '../../services/notification.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-notification-detail',
  templateUrl: './notification-detail.component.html',
  styleUrls: ['./notification-detail.component.css'],
  imports: [SidebarComponent, CommonModule]
})
export class NotificationDetailComponent implements OnInit {
  notification?: AppNotification;

  constructor(
    private route: ActivatedRoute,
    private ns: NotificationService,
    private router: Router
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      const n = this.ns.getById(id);
      if (n) {
        this.notification = n;
        // 👇 Detailを開いた瞬間に自動で既読化
        if (!n.read) this.ns.markAsRead(id);
      }
    }
  }

  back() {
    this.router.navigate(['/notifications']);
  }
}
