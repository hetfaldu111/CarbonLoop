import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { IMPURITIES, PassportDto } from '../../core/models';
import { Alert, FieldError, PageHeader } from '../../shared/widgets';
import { Check, FieldErrors, addDays, errMsg, isBlank, scrollToFirstInvalid, toDateInput, toDateTimeInput } from '../../shared/utils';

interface KV { key: string; value: string; }

@Component({
  selector: 'app-passport-form',
  imports: [FormsModule, RouterLink, Alert, FieldError, PageHeader],
  template: `
    <app-page-header title="New CO₂ Passport" subtitle="Core fields follow the CO₂ Passport schema; anything else goes into extensible extra attributes. Submitting queues an independent lab Certificate of Analysis — self-reported specs are never trusted." />
    <app-alert [message]="error()" />
    <form class="form" (ngSubmit)="submit()">
      <fieldset>
        <legend>Source &amp; capture</legend>
        <div class="form-row">
          <div class="field" [class.invalid]="fe()['source']">
            <label>Source <span class="required-star">*</span></label>
            <input name="source" [(ngModel)]="f.source" placeholder="e.g. Cement kiln flue gas" required [attr.aria-invalid]="fe()['source'] ? 'true' : null" />
            <app-field-error [msg]="fe()['source']" />
          </div>
          <div class="field"><label>Carbon origin</label><select name="carbonOrigin" [(ngModel)]="f.carbonOrigin"><option value="FOSSIL">Fossil</option><option value="PROCESS">Process emission</option><option value="BIOGENIC">Biogenic</option></select></div>
          <div class="field" [class.invalid]="fe()['captureTechnology']">
            <label>Capture technology <span class="required-star">*</span></label>
            <input name="captureTechnology" [(ngModel)]="f.captureTechnology" placeholder="e.g. Amine capture" required [attr.aria-invalid]="fe()['captureTechnology'] ? 'true' : null" />
            <app-field-error [msg]="fe()['captureTechnology']" />
          </div>
          <div class="field" [class.invalid]="fe()['meterId']">
            <label>Meter ID (signed readings) <span class="required-star">*</span></label>
            <input name="meterId" [(ngModel)]="f.meterId" placeholder="MTR-XXX-01" required [attr.aria-invalid]="fe()['meterId'] ? 'true' : null" />
            <app-field-error [msg]="fe()['meterId']" />
          </div>
        </div>
      </fieldset>
      <fieldset>
        <legend>Availability &amp; volume</legend>
        <div class="form-row">
          <div class="field" [class.invalid]="fe()['dailyTonnage']">
            <label>Available (t/day) <span class="required-star">*</span></label>
            <input type="number" step="0.1" name="dailyTonnage" [(ngModel)]="f.dailyTonnage" required [attr.aria-invalid]="fe()['dailyTonnage'] ? 'true' : null" />
            <app-field-error [msg]="fe()['dailyTonnage']" />
          </div>
          <div class="field" [class.invalid]="fe()['dailyTonnageMin']">
            <label>Range min (t/day)</label>
            <input type="number" step="0.1" name="dailyTonnageMin" [(ngModel)]="f.dailyTonnageMin" [attr.aria-invalid]="fe()['dailyTonnageMin'] ? 'true' : null" />
            <app-field-error [msg]="fe()['dailyTonnageMin']" />
          </div>
          <div class="field" [class.invalid]="fe()['dailyTonnageMax']">
            <label>Range max (t/day)</label>
            <input type="number" step="0.1" name="dailyTonnageMax" [(ngModel)]="f.dailyTonnageMax" [attr.aria-invalid]="fe()['dailyTonnageMax'] ? 'true' : null" />
            <app-field-error [msg]="fe()['dailyTonnageMax']" />
          </div>
          <div class="field" [class.invalid]="fe()['totalVolumeTonnes']">
            <label>Total volume offered (t) <span class="required-star">*</span></label>
            <input type="number" step="1" name="totalVolumeTonnes" [(ngModel)]="f.totalVolumeTonnes" required [attr.aria-invalid]="fe()['totalVolumeTonnes'] ? 'true' : null" />
            <span class="hint">The pool that tender / auction / contract allocations lock against.</span>
            <app-field-error [msg]="fe()['totalVolumeTonnes']" />
          </div>
        </div>
        <div class="form-row">
          <div class="field" [class.invalid]="fe()['availabilityStart']">
            <label>Availability window start <span class="required-star">*</span></label>
            <input type="date" name="availabilityStart" [(ngModel)]="f.availabilityStart" required [attr.aria-invalid]="fe()['availabilityStart'] ? 'true' : null" />
            <app-field-error [msg]="fe()['availabilityStart']" />
          </div>
          <div class="field" [class.invalid]="fe()['availabilityEnd']">
            <label>Availability window end <span class="required-star">*</span></label>
            <input type="date" name="availabilityEnd" [(ngModel)]="f.availabilityEnd" required [attr.aria-invalid]="fe()['availabilityEnd'] ? 'true' : null" />
            <app-field-error [msg]="fe()['availabilityEnd']" />
          </div>
          <div class="field" [class.invalid]="fe()['captureTimestamp']">
            <label>Capture timestamp <span class="required-star">*</span></label>
            <input type="datetime-local" name="captureTimestamp" [(ngModel)]="f.captureTimestamp" required [attr.aria-invalid]="fe()['captureTimestamp'] ? 'true' : null" />
            <app-field-error [msg]="fe()['captureTimestamp']" />
          </div>
        </div>
      </fieldset>
      <fieldset>
        <legend>Composition &amp; physical state (claimed — to be verified by lab)</legend>
        <div class="form-row">
          <div class="field" [class.invalid]="fe()['concentrationPct']">
            <label>CO₂ concentration (%) <span class="required-star">*</span></label>
            <input type="number" step="0.01" name="concentrationPct" [(ngModel)]="f.concentrationPct" required [attr.aria-invalid]="fe()['concentrationPct'] ? 'true' : null" />
            <app-field-error [msg]="fe()['concentrationPct']" />
          </div>
          <div class="field"><label>State</label><select name="physicalState" [(ngModel)]="f.physicalState"><option value="LIQUEFIED">Liquefied</option><option value="GASEOUS">Gaseous</option></select></div>
          <div class="field" [class.invalid]="fe()['pressureBar']">
            <label>Pressure (bar)</label>
            <input type="number" step="0.1" name="pressureBar" [(ngModel)]="f.pressureBar" [attr.aria-invalid]="fe()['pressureBar'] ? 'true' : null" />
            <app-field-error [msg]="fe()['pressureBar']" />
          </div>
          <div class="field"><label>Temperature (°C)</label><input type="number" step="0.1" name="temperatureC" [(ngModel)]="f.temperatureC" /></div>
        </div>
        <div class="form-row">
          @for (i of impurities; track i) {
            <div class="field" [class.invalid]="fe()['imp_' + i]">
              <label>{{ i }} (ppm)</label>
              <input type="number" step="0.1" [name]="'imp_' + i" [(ngModel)]="imp[i]" [attr.aria-invalid]="fe()['imp_' + i] ? 'true' : null" />
              <app-field-error [msg]="fe()['imp_' + i]" />
            </div>
          }
        </div>
      </fieldset>
      <fieldset>
        <legend>Location</legend>
        <div class="form-row">
          <div class="field" [class.invalid]="fe()['locationName']">
            <label>Location name <span class="required-star">*</span></label>
            <input name="locationName" [(ngModel)]="f.locationName" required [attr.aria-invalid]="fe()['locationName'] ? 'true' : null" />
            <app-field-error [msg]="fe()['locationName']" />
          </div>
          <div class="field" [class.invalid]="fe()['latitude']">
            <label>Latitude <span class="required-star">*</span></label>
            <input type="number" step="0.0001" name="latitude" [(ngModel)]="f.latitude" required [attr.aria-invalid]="fe()['latitude'] ? 'true' : null" />
            <app-field-error [msg]="fe()['latitude']" />
          </div>
          <div class="field" [class.invalid]="fe()['longitude']">
            <label>Longitude <span class="required-star">*</span></label>
            <input type="number" step="0.0001" name="longitude" [(ngModel)]="f.longitude" required [attr.aria-invalid]="fe()['longitude'] ? 'true' : null" />
            <app-field-error [msg]="fe()['longitude']" />
          </div>
          <div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" name="pipelineConnected" [(ngModel)]="f.pipelineConnected" /> Pipeline-connected site</label></div>
        </div>
      </fieldset>
      <fieldset>
        <legend>Certifications (documents)</legend>
        @if (fe()['certs']) {<app-field-error [msg]="fe()['certs']" />}
        @for (c of certs; track $index; let i = $index) {
          <div class="form-row">
            <div class="field"><input [name]="'cert_name_' + i" [(ngModel)]="c.name" placeholder="Document name (e.g. ISO 14064 audit)" /></div>
            <div class="field"><input [name]="'cert_url_' + i" [(ngModel)]="c.url" placeholder="https://res.cloudinary.com/…" /></div>
            <div><button type="button" class="btn btn-sm" (click)="certs.splice(i, 1)">Remove</button></div>
          </div>
        }
        <button type="button" class="btn btn-sm" (click)="certs.push({ name: '', url: '' })">+ Add document</button>
      </fieldset>
      <fieldset>
        <legend>Extra attributes (extensible schema, stored as JSON)</legend>
        @for (e of extras; track $index; let i = $index) {
          <div class="form-row">
            <div class="field"><input [name]="'x_key_' + i" [(ngModel)]="e.key" placeholder="Attribute, e.g. mrvProvider" /></div>
            <div class="field"><input [name]="'x_val_' + i" [(ngModel)]="e.value" placeholder="Value" /></div>
            <div><button type="button" class="btn btn-sm" (click)="extras.splice(i, 1)">Remove</button></div>
          </div>
        }
        <button type="button" class="btn btn-sm" (click)="extras.push({ key: '', value: '' })">+ Add attribute</button>
      </fieldset>
      <div class="form-actions"><a class="btn" routerLink="/emitter/passports">Cancel</a><button class="btn btn-primary" [disabled]="busy()">Create passport &amp; request lab verification</button></div>
    </form>`,
})
export class PassportForm {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private router = inject(Router);
  impurities = IMPURITIES;
  busy = signal(false);
  error = signal<string | null>(null);
  /** Per-field messages, filled only when a submit is attempted. */
  fe = signal<FieldErrors>({});
  imp: Record<string, number> = { H2O: 30, O2: 100, NOx: 15, SOx: 10, H2S: 2, CO: 10, N2: 4000 };
  certs: { name: string; url: string }[] = [{ name: '', url: '' }];
  extras: KV[] = [];
  f = {
    source: '', carbonOrigin: 'PROCESS', captureTechnology: '', meterId: '', dailyTonnage: 20, dailyTonnageMin: 18, dailyTonnageMax: 25, totalVolumeTonnes: 500,
    availabilityStart: toDateInput(new Date()), availabilityEnd: toDateInput(addDays(new Date(), 180)), captureTimestamp: toDateTimeInput(new Date()),
    concentrationPct: 96.5, physicalState: 'LIQUEFIED', pressureBar: 18, temperatureC: -25, locationName: '', latitude: 22.3, longitude: 70.8, pipelineConnected: false,
  };

  constructor() {
    this.api.myCompany().subscribe({ next: (c) => { this.f.latitude = c.latitude; this.f.longitude = c.longitude; this.f.locationName = `${c.name} — ${c.city}`; }, error: () => {} });
  }

  private validate(): Check {
    const c = new Check();
    const f = this.f;
    c.required('source', f.source, 'Source');
    c.required('captureTechnology', f.captureTechnology, 'Capture technology');
    c.required('meterId', f.meterId, 'Meter ID');

    c.num('dailyTonnage', f.dailyTonnage, 'Daily availability', { gt: 0, unit: ' t/day' });
    if (!isBlank(f.dailyTonnageMin)) c.num('dailyTonnageMin', f.dailyTonnageMin, 'Range min', { min: 0, unit: ' t/day' });
    if (!isBlank(f.dailyTonnageMax)) c.num('dailyTonnageMax', f.dailyTonnageMax, 'Range max', { min: 0, unit: ' t/day' });
    c.when(!isBlank(f.dailyTonnageMin) && !isBlank(f.dailyTonnageMax) && Number(f.dailyTonnageMin) > Number(f.dailyTonnageMax),
      'dailyTonnageMax', 'Range max must be greater than or equal to range min.');
    c.num('totalVolumeTonnes', f.totalVolumeTonnes, 'Total volume offered', { gt: 0, unit: ' t' });

    c.required('availabilityStart', f.availabilityStart, 'Availability window start');
    c.required('availabilityEnd', f.availabilityEnd, 'Availability window end');
    c.when(Check.notAfter(f.availabilityStart, f.availabilityEnd), 'availabilityEnd', 'The availability window must end after it starts.');
    c.required('captureTimestamp', f.captureTimestamp, 'Capture timestamp');

    c.num('concentrationPct', f.concentrationPct, 'CO₂ concentration', { gt: 0, max: 100, unit: '%' });
    if (!isBlank(f.pressureBar)) c.num('pressureBar', f.pressureBar, 'Pressure', { min: 0, unit: ' bar' });
    for (const i of this.impurities) {
      const v = this.imp[i];
      if (!isBlank(v)) c.num('imp_' + i, v, `${i} level`, { min: 0, unit: ' ppm' });
    }

    c.required('locationName', f.locationName, 'Location name');
    c.num('latitude', f.latitude, 'Latitude', { min: -90, max: 90 });
    c.num('longitude', f.longitude, 'Longitude', { min: -180, max: 180 });

    // A document row is only useful with both halves filled in.
    const halfCert = this.certs.some((x) => (!!x.name.trim()) !== (!!x.url.trim()));
    c.when(halfCert, 'certs', 'Every certification needs both a document name and a link, or leave the row empty.');
    return c;
  }

  submit(): void {
    const c = this.validate();
    if (!c.ok) { this.fe.set(c.errors); this.error.set(null); scrollToFirstInvalid(); return; }
    this.fe.set({});

    this.busy.set(true); this.error.set(null);
    const extra: Record<string, unknown> = {};
    for (const e of this.extras) if (e.key.trim()) extra[e.key.trim()] = e.value;
    const body: Partial<PassportDto> = {
      ...this.f,
      dailyTonnage: +this.f.dailyTonnage, dailyTonnageMin: +this.f.dailyTonnageMin, dailyTonnageMax: +this.f.dailyTonnageMax, totalVolumeTonnes: +this.f.totalVolumeTonnes,
      concentrationPct: +this.f.concentrationPct, pressureBar: +this.f.pressureBar, temperatureC: +this.f.temperatureC, latitude: +this.f.latitude, longitude: +this.f.longitude,
      captureTimestamp: new Date(this.f.captureTimestamp).toISOString(),
      impurities: Object.fromEntries(Object.entries(this.imp).map(([k, v]) => [k, +v])),
      certifications: this.certs.filter((c) => c.name.trim() || c.url.trim()),
      extraAttributes: extra, mrvStatus: 'ACTIVE',
    };
    this.api.createPassport(body).subscribe({
      next: (p) => { this.busy.set(false); this.router.navigate(['/emitter/passports', p.id]); },
      error: (e) => { this.error.set(errMsg(e)); this.busy.set(false); },
    });
  }
}
