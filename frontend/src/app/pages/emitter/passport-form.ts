import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { IMPURITIES, PassportDto } from '../../core/models';
import { Alert, PageHeader } from '../../shared/widgets';
import { addDays, errMsg, toDateInput, toDateTimeInput } from '../../shared/utils';

interface KV { key: string; value: string; }

@Component({
  selector: 'app-passport-form',
  imports: [FormsModule, RouterLink, Alert, PageHeader],
  template: `
    <app-page-header title="New CO₂ Passport" subtitle="Core fields follow the CO₂ Passport schema; anything else goes into extensible extra attributes. Submitting queues an independent lab Certificate of Analysis — self-reported specs are never trusted." />
    <app-alert [message]="error()" />
    <form class="form" (ngSubmit)="submit()">
      <fieldset>
        <legend>Source &amp; capture</legend>
        <div class="form-row">
          <div class="field"><label>Source</label><input name="source" [(ngModel)]="f.source" placeholder="e.g. Cement kiln flue gas" required /></div>
          <div class="field"><label>Carbon origin</label><select name="carbonOrigin" [(ngModel)]="f.carbonOrigin"><option value="FOSSIL">Fossil</option><option value="PROCESS">Process emission</option><option value="BIOGENIC">Biogenic</option></select></div>
          <div class="field"><label>Capture technology</label><input name="captureTechnology" [(ngModel)]="f.captureTechnology" placeholder="e.g. Amine capture" required /></div>
          <div class="field"><label>Meter ID (signed readings)</label><input name="meterId" [(ngModel)]="f.meterId" placeholder="MTR-XXX-01" required /></div>
        </div>
      </fieldset>
      <fieldset>
        <legend>Availability &amp; volume</legend>
        <div class="form-row">
          <div class="field"><label>Available (t/day)</label><input type="number" step="0.1" name="dailyTonnage" [(ngModel)]="f.dailyTonnage" required /></div>
          <div class="field"><label>Range min (t/day)</label><input type="number" step="0.1" name="dailyTonnageMin" [(ngModel)]="f.dailyTonnageMin" /></div>
          <div class="field"><label>Range max (t/day)</label><input type="number" step="0.1" name="dailyTonnageMax" [(ngModel)]="f.dailyTonnageMax" /></div>
          <div class="field"><label>Total volume offered (t)</label><input type="number" step="1" name="totalVolumeTonnes" [(ngModel)]="f.totalVolumeTonnes" required /><span class="hint">The pool that tender / auction / contract allocations lock against.</span></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Availability window start</label><input type="date" name="availabilityStart" [(ngModel)]="f.availabilityStart" required /></div>
          <div class="field"><label>Availability window end</label><input type="date" name="availabilityEnd" [(ngModel)]="f.availabilityEnd" required /></div>
          <div class="field"><label>Capture timestamp</label><input type="datetime-local" name="captureTimestamp" [(ngModel)]="f.captureTimestamp" required /></div>
        </div>
      </fieldset>
      <fieldset>
        <legend>Composition &amp; physical state (claimed — to be verified by lab)</legend>
        <div class="form-row">
          <div class="field"><label>CO₂ concentration (%)</label><input type="number" step="0.01" name="concentrationPct" [(ngModel)]="f.concentrationPct" required /></div>
          <div class="field"><label>State</label><select name="physicalState" [(ngModel)]="f.physicalState"><option value="LIQUEFIED">Liquefied</option><option value="GASEOUS">Gaseous</option></select></div>
          <div class="field"><label>Pressure (bar)</label><input type="number" step="0.1" name="pressureBar" [(ngModel)]="f.pressureBar" /></div>
          <div class="field"><label>Temperature (°C)</label><input type="number" step="0.1" name="temperatureC" [(ngModel)]="f.temperatureC" /></div>
        </div>
        <div class="form-row">
          @for (i of impurities; track i) {
            <div class="field"><label>{{ i }} (ppm)</label><input type="number" step="0.1" [name]="'imp_' + i" [(ngModel)]="imp[i]" /></div>
          }
        </div>
      </fieldset>
      <fieldset>
        <legend>Location</legend>
        <div class="form-row">
          <div class="field"><label>Location name</label><input name="locationName" [(ngModel)]="f.locationName" required /></div>
          <div class="field"><label>Latitude</label><input type="number" step="0.0001" name="latitude" [(ngModel)]="f.latitude" required /></div>
          <div class="field"><label>Longitude</label><input type="number" step="0.0001" name="longitude" [(ngModel)]="f.longitude" required /></div>
          <div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" name="pipelineConnected" [(ngModel)]="f.pipelineConnected" /> Pipeline-connected site</label></div>
        </div>
      </fieldset>
      <fieldset>
        <legend>Certifications (documents)</legend>
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

  submit(): void {
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
