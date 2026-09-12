import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Alert } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, Alert],
  template: `
    <div class="container">
      <div class="card auth-box">
        <h2>Log in</h2>
        <p class="muted">Only companies approved by the platform admin can log in.</p>
        <app-alert [message]="error()" />
        <form class="form" (ngSubmit)="submit()">
          <div class="field"><label>Email</label><input type="email" name="email" [(ngModel)]="email" required autocomplete="username" /></div>
          <div class="field"><label>Password</label><input type="password" name="password" [(ngModel)]="password" required autocomplete="current-password" /></div>
          <div class="form-actions"><button class="btn btn-primary" [disabled]="busy()">Log in</button></div>
        </form>
        <hr class="divider" />
        <p class="small muted">No account? <a routerLink="/register">Register your company</a>.</p>
        <details>
          <summary class="small">Demo accounts (password: Password123!)</summary>
          <ul class="small muted">
            <li>admin&#64;carbon.local — Admin</li>
            <li>cement&#64;carbon.local · steel&#64;carbon.local · power&#64;carbon.local — Emitters</li>
            <li>methanol&#64;carbon.local · greenhouse&#64;carbon.local · algae&#64;carbon.local · concrete&#64;carbon.local — Utilizers</li>
            <li>gujtrans&#64;carbon.local · odtrans&#64;carbon.local — Transport</li>
            <li>lab&#64;carbon.local — Verification lab · regulator&#64;carbon.local — Regulator</li>
          </ul>
        </details>
      </div>
    </div>`,
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  email = '';
  password = '';
  busy = signal(false);
  error = signal<string | null>(null);

  submit(): void {
    this.busy.set(true); this.error.set(null);
    this.auth.login(this.email.trim(), this.password).subscribe({
      next: (res) => {
        this.busy.set(false);
        const ret = this.route.snapshot.queryParamMap.get('returnUrl');
        this.router.navigateByUrl(ret || this.auth.homeFor(res.user.role));
      },
      error: (e) => { this.busy.set(false); this.error.set(errMsg(e, 'Login failed')); },
    });
  }
}
