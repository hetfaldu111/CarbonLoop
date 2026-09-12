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

      <!-- Ambient carbon-loop backdrop. Decorative only. -->
      <div class="login-bg" aria-hidden="true">
        <svg viewBox="0 0 900 900" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id="lgGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#30BE69" stop-opacity="0.22" />
              <stop offset="55%" stop-color="#30BE69" stop-opacity="0.08" />
              <stop offset="100%" stop-color="#30BE69" stop-opacity="0" />
            </radialGradient>
            <!-- one shared circular track per radius -->
            <path id="lgTrack270" d="M 450,180 a 270,270 0 1,1 0,540 a 270,270 0 1,1 0,-540" />
            <path id="lgTrack200" d="M 450,250 a 200,200 0 1,1 0,400 a 200,200 0 1,1 0,-400" />
            <g id="lgMolecule">
              <circle cx="-11" cy="0" r="5.5" fill="#30BE69" opacity="0.7" />
              <circle cx="0" cy="0" r="7.5" fill="#1A3C2A" opacity="0.85" />
              <circle cx="11" cy="0" r="5.5" fill="#30BE69" opacity="0.7" />
              <line x1="-11" y1="0" x2="11" y2="0" stroke="#1A3C2A" stroke-width="1.3" opacity="0.45" />
            </g>
          </defs>

          <circle cx="450" cy="450" r="430" fill="url(#lgGlow)" />

          <!-- rings: outer and inner turn in opposite directions -->
          <g class="lg-spin-cw">
            <circle cx="450" cy="450" r="340" fill="none" stroke="#1A3C2A" stroke-opacity="0.2"
                    stroke-width="1.2" stroke-dasharray="2 14" stroke-linecap="round" />
          </g>
          <circle cx="450" cy="450" r="305" fill="none" stroke="#30BE69" stroke-opacity="0.16" stroke-width="1.1" />
          <g class="lg-spin-ccw">
            <circle cx="450" cy="450" r="200" fill="none" stroke="#1A3C2A" stroke-opacity="0.24"
                    stroke-width="1.4" stroke-dasharray="18 12" stroke-linecap="round" />
          </g>
          <circle class="lg-breathe" cx="450" cy="450" r="130" fill="none"
                  stroke="#30BE69" stroke-opacity="0.22" stroke-width="1.2" stroke-dasharray="1 9" stroke-linecap="round" />

          <!-- the loop itself, drawn as a travelling arc -->
          <circle class="lg-trace" cx="450" cy="450" r="270" fill="none"
                  stroke="#30BE69" stroke-opacity="0.62" stroke-width="2.6" stroke-linecap="round" />

          <!-- four stage nodes on the loop -->
          @for (s of stages; track s.label) {
            <g class="lg-node" [style.animation-delay]="s.delay">
              <circle [attr.cx]="s.x" [attr.cy]="s.y" r="7" fill="#EFF5F0" stroke="#1A3C2A" stroke-opacity="0.45" stroke-width="1.3" />
              <circle [attr.cx]="s.x" [attr.cy]="s.y" r="2.6" fill="#30BE69" />
            </g>
          }

          <!-- CO2 molecules riding the loop -->
          @for (m of molecules; track m.begin) {
            <use href="#lgMolecule" opacity="0.9">
              <animateMotion [attr.dur]="m.dur" repeatCount="indefinite" [attr.begin]="m.begin"
                             rotate="auto" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                <mpath href="#lgTrack270" />
              </animateMotion>
            </use>
          }
          <use href="#lgMolecule" opacity="0.5" transform="scale(0.72)" transform-origin="450 450">
            <animateMotion dur="26s" repeatCount="indefinite" begin="-6s" rotate="auto">
              <mpath href="#lgTrack200" />
            </animateMotion>
          </use>

          <!-- drifting motes -->
          @for (d of motes; track d.cx) {
            <circle class="lg-mote" [attr.cx]="d.cx" [attr.cy]="d.cy" [attr.r]="d.r"
                    fill="#30BE69" [style.animation-duration]="d.dur" [style.animation-delay]="d.delay" />
          }
        </svg>
      </div>

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

  /** Four stage nodes sitting on the r=270 loop at 12, 3, 6 and 9 o'clock. */
  stages = [
    { label: 'capture', x: 450, y: 180, delay: '0s' },
    { label: 'passport', x: 720, y: 450, delay: '1.5s' },
    { label: 'transport', x: 450, y: 720, delay: '3s' },
    { label: 'utilize', x: 180, y: 450, delay: '4.5s' },
  ];
  /** Staggered negative begins so the molecules are already spread around the loop on load. */
  molecules = [
    { dur: '18s', begin: '0s' },
    { dur: '18s', begin: '-4.5s' },
    { dur: '18s', begin: '-9s' },
    { dur: '18s', begin: '-13.5s' },
  ];
  motes = [
    { cx: 170, cy: 700, r: 3, dur: '13s', delay: '0s' },
    { cx: 300, cy: 780, r: 2, dur: '17s', delay: '2s' },
    { cx: 620, cy: 750, r: 2.5, dur: '15s', delay: '4s' },
    { cx: 760, cy: 690, r: 2, dur: '19s', delay: '1s' },
    { cx: 240, cy: 320, r: 2, dur: '21s', delay: '6s' },
    { cx: 690, cy: 270, r: 2.5, dur: '16s', delay: '3s' },
  ];
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
