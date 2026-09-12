import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Alert } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

interface DemoAccount { email: string; label: string; note: string; }
interface DemoGroup { title: string; accounts: DemoAccount[]; }

/** Split so the two panels flank the card evenly. */
const LEFT: DemoGroup[] = [
  {
    title: 'Emitters',
    accounts: [
      { email: 'cement@carbon.local', label: 'Saurashtra Cement Works', note: 'Porbandar · tender + live auction' },
      { email: 'steel@carbon.local', label: 'Kalinga Steel Plant', note: 'Angul · two-winner tender' },
      { email: 'power@carbon.local', label: 'Kutch Thermal Power', note: 'Mundra · pipeline connected' },
    ],
  },
  {
    title: 'Platform',
    accounts: [
      { email: 'admin@carbon.local', label: 'Marketplace Admin', note: 'Approvals + company search' },
      { email: 'lab@carbon.local', label: 'National CO₂ Testing Lab', note: 'Verification queue' },
      { email: 'regulator@carbon.local', label: 'NITI CCUS Oversight Cell', note: 'Read-only oversight' },
    ],
  },
];

const RIGHT: DemoGroup[] = [
  {
    title: 'Utilizers',
    accounts: [
      { email: 'methanol@carbon.local', label: 'Gujarat Methanol Synthesis', note: 'Gold · cost estimator' },
      { email: 'algae@carbon.local', label: 'Bay of Bengal Algae Farms', note: 'Diamond · shipments' },
      { email: 'greenhouse@carbon.local', label: 'Sabarmati Agro Greenhouses', note: 'Silver · leading a bid' },
      { email: 'concrete@carbon.local', label: 'Carbonated Concrete Co', note: 'Bronze · high cancellations' },
    ],
  },
  {
    title: 'Transport',
    accounts: [
      { email: 'gujtrans@carbon.local', label: 'Saurashtra Cryo Logistics', note: 'Gujarat fleet' },
      { email: 'odtrans@carbon.local', label: 'East Coast Gas Carriers', note: 'Odisha · assigned shipment' },
    ],
  },
];

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink, Alert],
  template: `
    <div class="login-page">
      <div class="login-grid">

        <!-- left demo panel -->
        <aside class="demo-panel left">
          @for (g of left; track g.title) {
            <div class="demo-group">
              <div class="demo-title">{{ g.title }}</div>
              @for (a of g.accounts; track a.email) {
                <button type="button" class="demo-row" (click)="use(a.email)" [class.active]="email === a.email">
                  <span class="demo-label">{{ a.label }}</span>
                  <span class="demo-mail">{{ a.email }}</span>
                  <span class="demo-note">{{ a.note }}</span>
                </button>
              }
            </div>
          }
        </aside>

        <!-- centre card -->
        <main class="login-card">
          <div class="login-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="34" height="34">
              <circle cx="16" cy="16" r="14" fill="none" stroke="var(--forest, #1A3C2A)" stroke-width="2" />
              <circle cx="16" cy="16" r="5" fill="var(--eco, #30BE69)" />
            </svg>
          </div>
          <h1>Sign in</h1>
          <p class="login-sub">Continue to CarbonLoop</p>

          <app-alert [message]="error()" />

          <form class="login-form" (ngSubmit)="submit()">
            <div class="lf">
              <input id="email" type="email" name="email" [(ngModel)]="email" required autocomplete="username" placeholder=" " />
              <label for="email">Email</label>
            </div>
            <div class="lf">
              <input id="password" [type]="show() ? 'text' : 'password'" name="password" [(ngModel)]="password" required autocomplete="current-password" placeholder=" " />
              <label for="password">Password</label>
              <button type="button" class="peek" (click)="show.set(!show())" [attr.aria-label]="show() ? 'Hide password' : 'Show password'">{{ show() ? 'Hide' : 'Show' }}</button>
            </div>

            <p class="login-hint">Only companies approved by the admin can sign in.</p>

            <div class="login-actions">
              <a routerLink="/register" class="link-quiet">Create account</a>
              <button class="btn-signin" [disabled]="busy()">{{ busy() ? 'Signing in…' : 'Next' }}</button>
            </div>
          </form>

          <p class="login-foot">Demo password for every account: <code>Password123!</code></p>
        </main>

        <!-- right demo panel -->
        <aside class="demo-panel right">
          @for (g of right; track g.title) {
            <div class="demo-group">
              <div class="demo-title">{{ g.title }}</div>
              @for (a of g.accounts; track a.email) {
                <button type="button" class="demo-row" (click)="use(a.email)" [class.active]="email === a.email">
                  <span class="demo-label">{{ a.label }}</span>
                  <span class="demo-mail">{{ a.email }}</span>
                  <span class="demo-note">{{ a.note }}</span>
                </button>
              }
            </div>
          }
        </aside>

      </div>
    </div>`,
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  left = LEFT;
  right = RIGHT;
  email = '';
  password = '';
  show = signal(false);
  busy = signal(false);
  error = signal<string | null>(null);

  /** One click fills both fields so a demo account is a single extra click away. */
  use(email: string): void {
    this.email = email;
    this.password = 'Password123!';
    this.error.set(null);
  }

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
