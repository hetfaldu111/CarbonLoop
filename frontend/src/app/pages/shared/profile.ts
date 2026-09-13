import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { CompanyDto, Tier } from '../../core/models';
import { StatusBadge, TierBadge } from '../../shared/badges';
import { LabelPipe } from '../../shared/pipes';
import { Alert, FieldError, Loading, PageHeader } from '../../shared/widgets';
import { Check, FieldErrors, errMsg, scrollToFirstInvalid } from '../../shared/utils';

/**
 * The profile every signed-in role shares. It is split in two deliberately: the top card is what
 * an admin verified at registration and therefore cannot be self-edited, the bottom card is the
 * contact and location detail a company is expected to keep current itself.
 *
 * Latitude and longitude are editable because the delivered-cost stack prices distance from them —
 * a stale site location quietly mis-prices every quote the company gives or receives.
 */
@Component({
  selector: 'app-profile',
  imports: [DatePipe, FormsModule, StatusBadge, TierBadge, LabelPipe, Alert, FieldError, Loading, PageHeader],
  template: `
    @if (loading()) {<app-loading />}
    <app-alert [message]="error()" />
    <app-alert [message]="ok()" tone="success" />

    @if (c(); as c) {
      <app-page-header title="Profile" [subtitle]="'Signed in as ' + c.contactEmail">
        <app-status-badge [value]="c.status" />
      </app-page-header>

      <!-- ===== Verified at registration — read only ===== -->
      <div class="card mb">
        <div class="reco-head">
          <h3>Registered identity</h3>
          @if (tier()) {<app-tier-badge [tier]="tier()" [basis]="basis()" />}
        </div>
        <p class="muted small">An administrator approved these details. Contact support if any of them are wrong.</p>
        <dl class="kv">
          <dt>Company</dt><dd>{{ c.name }}</dd>
          <dt>Role</dt><dd>{{ c.role | label }}</dd>
          <dt>Sector</dt><dd>{{ (c.sector | label) || '—' }}</dd>
          <dt>Registration no.</dt><dd class="mono">{{ c.registrationNumber || '—' }}</dd>
          <dt>Login email</dt><dd>{{ c.contactEmail }}</dd>
          <dt>Registered</dt><dd>{{ c.createdAt | date:'mediumDate' }}@if (c.approvedAt) { · approved {{ c.approvedAt | date:'mediumDate' }}}</dd>
        </dl>
      </div>

      <!-- ===== Contact details — editable ===== -->
      <div class="card">
        <h3>Contact details</h3>
        <p class="muted small">Counterparties and hauliers use this to reach you. Coordinates set the pickup point used to price transport.</p>

        <form class="form mt" (ngSubmit)="save()">
          <div class="form-row">
            <div class="field" [class.invalid]="fe()['contactPhone']">
              <label for="contactPhone">Contact phone <span class="required-star">*</span></label>
              <input id="contactPhone" name="contactPhone" [(ngModel)]="f.contactPhone" placeholder="+91 98250 00000"
                     [attr.aria-invalid]="fe()['contactPhone'] ? 'true' : null" />
              <app-field-error [msg]="fe()['contactPhone']" />
            </div>
            <div class="field">
              <label for="country">Country <span class="required-star">*</span></label>
              <input id="country" name="country" [(ngModel)]="f.country" [attr.aria-invalid]="fe()['country'] ? 'true' : null" />
              <app-field-error [msg]="fe()['country']" />
            </div>
          </div>

          <div class="field" [class.invalid]="fe()['address']">
            <label for="address">Street address <span class="required-star">*</span></label>
            <input id="address" name="address" [(ngModel)]="f.address" placeholder="Plot 42, GIDC Estate"
                   [attr.aria-invalid]="fe()['address'] ? 'true' : null" />
            <app-field-error [msg]="fe()['address']" />
          </div>

          <div class="form-row">
            <div class="field" [class.invalid]="fe()['city']">
              <label for="city">City <span class="required-star">*</span></label>
              <input id="city" name="city" [(ngModel)]="f.city" [attr.aria-invalid]="fe()['city'] ? 'true' : null" />
              <app-field-error [msg]="fe()['city']" />
            </div>
            <div class="field" [class.invalid]="fe()['state']">
              <label for="state">State <span class="required-star">*</span></label>
              <input id="state" name="state" [(ngModel)]="f.state" [attr.aria-invalid]="fe()['state'] ? 'true' : null" />
              <app-field-error [msg]="fe()['state']" />
            </div>
          </div>

          <div class="form-row">
            <div class="field" [class.invalid]="fe()['latitude']">
              <label for="latitude">Latitude <span class="required-star">*</span></label>
              <input id="latitude" type="number" step="0.0001" name="latitude" [(ngModel)]="f.latitude"
                     [attr.aria-invalid]="fe()['latitude'] ? 'true' : null" />
              <app-field-error [msg]="fe()['latitude']" />
            </div>
            <div class="field" [class.invalid]="fe()['longitude']">
              <label for="longitude">Longitude <span class="required-star">*</span></label>
              <input id="longitude" type="number" step="0.0001" name="longitude" [(ngModel)]="f.longitude"
                     [attr.aria-invalid]="fe()['longitude'] ? 'true' : null" />
              <app-field-error [msg]="fe()['longitude']" />
            </div>
          </div>

          <div class="form-actions mt">
            @if (dirty()) {<span class="muted small">Unsaved changes.</span>}
            <button type="button" class="btn btn-sm" (click)="reset()" [disabled]="busy() || !dirty()">Discard changes</button>
            <button type="submit" class="btn btn-primary" [disabled]="busy() || !dirty()">Save changes</button>
          </div>
        </form>
      </div>
    }`,
})
export class Profile {
  private api = inject(ApiService);
  c = signal<CompanyDto | null>(null);
  tier = signal<Tier | null>(null);
  basis = signal<string | null>(null);
  fe = signal<FieldErrors>({});
  loading = signal(true);
  busy = signal(false);
  error = signal<string | null>(null);
  ok = signal<string | null>(null);

  f = { contactPhone: '', address: '', city: '', state: '', country: '', latitude: 0, longitude: 0 };
  /** The last saved values, so "Save" stays disabled until something actually differs. */
  private original = JSON.stringify(this.f);

  ngOnInit(): void {
    this.api.myCompany().subscribe({
      next: (c) => { this.c.set(c); this.fill(c); this.loading.set(false); },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
    // Only the two trading roles carry a tier; the others have no badge to show.
    this.api.myTrust().subscribe({ next: (t) => { this.tier.set(t.tier); this.basis.set(t.badgeBasis ?? null); }, error: () => {} });
  }

  private fill(c: CompanyDto): void {
    this.f = {
      contactPhone: c.contactPhone ?? '', address: c.address ?? '', city: c.city ?? '',
      state: c.state ?? '', country: c.country ?? '', latitude: c.latitude, longitude: c.longitude,
    };
    this.original = JSON.stringify(this.f);
  }

  dirty(): boolean { return JSON.stringify(this.f) !== this.original; }
  reset(): void { const c = this.c(); if (c) { this.fill(c); this.fe.set({}); this.ok.set(null); } }

  /**
   * Plain method rather than a computed(): the fields are ngModel-bound properties, not signals,
   * so a computed() would never re-run as the user types.
   */
  private validate(): Check {
    const c = new Check();
    c.required('contactPhone', this.f.contactPhone, 'Contact phone');
    c.required('address', this.f.address, 'Street address');
    c.required('city', this.f.city, 'City');
    c.required('state', this.f.state, 'State');
    c.required('country', this.f.country, 'Country');
    c.num('latitude', this.f.latitude, 'Latitude', { min: -90, max: 90 });
    c.num('longitude', this.f.longitude, 'Longitude', { min: -180, max: 180 });
    return c;
  }

  save(): void {
    const check = this.validate();
    this.fe.set(check.errors);
    if (!check.ok) { scrollToFirstInvalid(); return; }

    this.busy.set(true);
    this.error.set(null);
    this.ok.set(null);
    this.api.updateProfile({ ...this.f, latitude: Number(this.f.latitude), longitude: Number(this.f.longitude) }).subscribe({
      next: (c) => { this.c.set(c); this.fill(c); this.busy.set(false); this.ok.set('Profile updated.'); },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); },
    });
  }
}
