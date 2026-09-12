import { Injectable, effect, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  readonly unread = signal(0);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      if (this.auth.isLoggedIn()) this.start();
      else this.stop();
    });
  }

  refresh(): void {
    if (!this.auth.isLoggedIn()) return;
    this.api.unreadCount().subscribe({ next: (r) => this.unread.set(r.count), error: () => {} });
  }

  private start(): void {
    if (this.timer) return;
    this.refresh();
    this.timer = setInterval(() => this.refresh(), 30_000);
  }

  private stop(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.unread.set(0);
  }
}
