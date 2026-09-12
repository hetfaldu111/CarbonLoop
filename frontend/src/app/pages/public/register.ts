import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { INDIAN_STATES, RegisterRequest, Role, SECTORS } from '../../core/models';
import { Alert } from '../../shared/widgets';
import { LabelPipe } from '../../shared/pipes';
import { errMsg } from '../../shared/utils';

interface RoleProfile {
  captureTechnology?: string; annualCaptureCapacity?: number; emissionSource?: string;
  useCase?: string; annualDemand?: number; requiredPurity?: number;
  fleetPipeline?: boolean; fleetTruck?: boolean; fleetRail?: boolean; capacityPerDay?: number; serviceRadiusKm?: number;
  accreditationNumber?: string; testsOffered?: string; agency?: string; jurisdiction?: string;
}
interface RoleCard { role: Role; title: string; desc: string; icon: string; }
const ROLES: RoleCard[] = [
  { role: 'EMITTER', title: 'Carbon emitter', desc: 'Cement, steel, power, refinery… you capture CO₂ and want to sell it.', icon: '🏭' },
  { role: 'UTILIZER', title: 'Carbon utilizer', desc: 'Fuel synthesis, building materials, greenhouses, algae — you need CO₂.', icon: '🌱' },
  { role: 'TRANSPORT', title: 'Transport provider', desc: 'Pipeline, truck or rail logistics for liquefied / gaseous CO₂.', icon: '🚛' },
  { role: 'LAB', title: 'Verification lab', desc: 'Independent testing lab issuing Certificates of Analysis.', icon: '🔬' },
  { role: 'REGULATOR', title: 'Policy regulator', desc: 'Read-only oversight, compliance and incentive monitoring.', icon: '🏛' },
];

@Component({
  selector: 'app-register',
  imports: [FormsModule, RouterLink, Alert, LabelPipe],
  template: `
    <div class="container">
      <div class="card auth-box wide">
        @if (done()) {
          <h2>Registration received</h2>
          <div class="alert alert-success">Awaiting admin approval. The platform admin will verify your company (form review plus a call or site visit) before you can log in and transact.</div>
          <a class="btn btn-primary" routerLink="/login">Back to login</a>
        } @else {
          <h2>Register your company</h2>
          <p class="muted">Step 1 — choose your role. Step 2 — company and role-specific details. Every sign-up is manually verified by the admin.</p>
          <div class="role-cards mb">
            @for (r of roles; track r.role) {
              <div class="mode-card" [class.selected]="role() === r.role" (click)="role.set(r.role)">
                <div style="font-size:1.4rem">{{ r.icon }}</div><h4>{{ r.title }}</h4><p>{{ r.desc }}</p>
              </div>
            }
          </div>
          @if (role()) {
            <app-alert [message]="error()" />
            <form class="form" (ngSubmit)="submit()">
              <fieldset>
                <legend>Company</legend>
                <div class="form-row">
                  <div class="field"><label>Company name</label><input name="companyName" [(ngModel)]="f.companyName" required /></div>
                  <div class="field"><label>Registration number (CIN / GST)</label><input name="registrationNumber" [(ngModel)]="f.registrationNumber" required /></div>
                  <div class="field"><label>Sector</label>
                    <select name="sector" [(ngModel)]="f.sector" required>@for (s of sectors; track s) {<option [value]="s">{{ s | label }}</option>}</select>
                  </div>
                </div>
                <div class="form-row">
                  <div class="field"><label>Address</label><input name="address" [(ngModel)]="f.address" required /></div>
                  <div class="field"><label>City</label><input name="city" [(ngModel)]="f.city" required /></div>
                  <div class="field"><label>State</label>
                    <select name="state" [(ngModel)]="f.state" required>@for (s of states; track s) {<option [value]="s">{{ s }}</option>}</select>
                  </div>
                  <div class="field"><label>Country</label><input name="country" [(ngModel)]="f.country" required /></div>
                </div>
                <div class="form-row">
                  <div class="field"><label>Latitude</label><input type="number" step="0.0001" name="latitude" [(ngModel)]="f.latitude" required /><span class="hint">Used for distance, transport cost and provider radius.</span></div>
                  <div class="field"><label>Longitude</label><input type="number" step="0.0001" name="longitude" [(ngModel)]="f.longitude" required /></div>
                </div>
              </fieldset>
              <fieldset>
                <legend>Primary contact / login</legend>
                <div class="form-row">
                  <div class="field"><label>Full name</label><input name="fullName" [(ngModel)]="f.fullName" required /></div>
                  <div class="field"><label>Phone</label><input name="contactPhone" [(ngModel)]="f.contactPhone" required /></div>
                  <div class="field"><label>Email (login)</label><input type="email" name="email" [(ngModel)]="f.email" required /></div>
                  <div class="field"><label>Password</label><input type="password" name="password" [(ngModel)]="f.password" required minlength="8" /></div>
                </div>
              </fieldset>
              <fieldset>
                <legend>{{ roleTitle() }} details</legend>
                @switch (role()) {
                  @case ('EMITTER') {
                    <div class="form-row">
                      <div class="field"><label>Capture technology</label><input name="captureTechnology" [(ngModel)]="p.captureTechnology" placeholder="e.g. Amine capture" /></div>
                      <div class="field"><label>Annual capture capacity (t/yr)</label><input type="number" name="annualCaptureCapacity" [(ngModel)]="p.annualCaptureCapacity" /></div>
                      <div class="field"><label>Emission source</label><input name="emissionSource" [(ngModel)]="p.emissionSource" placeholder="e.g. Cement kiln flue gas" /></div>
                    </div>
                  }
                  @case ('UTILIZER') {
                    <div class="form-row">
                      <div class="field"><label>Use case</label><input name="useCase" [(ngModel)]="p.useCase" placeholder="e.g. Methanol synthesis" /></div>
                      <div class="field"><label>Annual CO₂ demand (t/yr)</label><input type="number" name="annualDemand" [(ngModel)]="p.annualDemand" /></div>
                      <div class="field"><label>Required purity (%)</label><input type="number" step="0.1" name="requiredPurity" [(ngModel)]="p.requiredPurity" /></div>
                    </div>
                  }
                  @case ('TRANSPORT') {
                    <div class="form-row">
                      <div class="field"><label>Fleet types</label>
                        <label class="check"><input type="checkbox" name="fleetPipeline" [(ngModel)]="p.fleetPipeline" /> Pipeline</label>
                        <label class="check"><input type="checkbox" name="fleetTruck" [(ngModel)]="p.fleetTruck" /> Cryogenic trucks</label>
                        <label class="check"><input type="checkbox" name="fleetRail" [(ngModel)]="p.fleetRail" /> Rail tankers</label>
                      </div>
                      <div class="field"><label>Capacity (t/day)</label><input type="number" name="capacityPerDay" [(ngModel)]="p.capacityPerDay" /></div>
                      <div class="field"><label>Service radius (km)</label><input type="number" name="serviceRadiusKm" [(ngModel)]="p.serviceRadiusKm" /></div>
                    </div>
                  }
                  @case ('LAB') {
                    <div class="form-row">
                      <div class="field"><label>Accreditation number (NABL)</label><input name="accreditationNumber" [(ngModel)]="p.accreditationNumber" /></div>
                      <div class="field"><label>Tests offered</label><input name="testsOffered" [(ngModel)]="p.testsOffered" placeholder="GC purity, moisture, sulphur species…" /></div>
                    </div>
                  }
                  @case ('REGULATOR') {
                    <div class="form-row">
                      <div class="field"><label>Agency</label><input name="agency" [(ngModel)]="p.agency" placeholder="e.g. NITI Aayog CCUS cell" /></div>
                      <div class="field"><label>Jurisdiction</label><input name="jurisdiction" [(ngModel)]="p.jurisdiction" placeholder="National / State" /></div>
                    </div>
                  }
                }
              </fieldset>
              <div class="form-actions">
                <a class="btn" routerLink="/login">Cancel</a>
                <button class="btn btn-primary" [disabled]="busy()">Submit for verification</button>
              </div>
            </form>
          }
        }
      </div>
    </div>`,
})
export class Register {
  private auth = inject(AuthService);
  roles = ROLES;
  sectors = SECTORS;
  states = INDIAN_STATES;
  role = signal<Role | null>(null);
  busy = signal(false);
  done = signal(false);
  error = signal<string | null>(null);
  f = { companyName: '', registrationNumber: '', sector: 'CEMENT', address: '', city: '', state: 'Gujarat', country: 'India', latitude: 22.3, longitude: 70.8, fullName: '', contactPhone: '', email: '', password: '' };
  p: RoleProfile = { fleetPipeline: false, fleetTruck: true, fleetRail: false };

  roleTitle(): string { return ROLES.find((r) => r.role === this.role())?.title ?? ''; }

  submit(): void {
    const role = this.role();
    if (!role) return;
    this.busy.set(true); this.error.set(null);
    const req: RegisterRequest = { role, ...this.f, latitude: Number(this.f.latitude), longitude: Number(this.f.longitude), roleProfile: { ...this.p } as Record<string, unknown> };
    this.auth.register(req).subscribe({
      next: () => { this.busy.set(false); this.done.set(true); },
      error: (e) => { this.busy.set(false); this.error.set(errMsg(e, 'Registration failed')); },
    });
  }
}
