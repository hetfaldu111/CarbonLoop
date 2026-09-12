import { Component, inject, signal } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { ApiService } from '../../core/api.service';
import { AuditEventDto, Page } from '../../core/models';
import { LabelPipe, ShortIdPipe } from '../../shared/pipes';
import { Alert, EmptyState, Loading, PageHeader } from '../../shared/widgets';
import { errMsg } from '../../shared/utils';

@Component({
  selector: 'app-audit-log',
  imports: [DatePipe, JsonPipe, LabelPipe, ShortIdPipe, Alert, EmptyState, Loading, PageHeader],
  template: `
    <app-page-header title="Audit trail" subtitle="Append-only event log. Each row's hash covers the previous row's hash, so any edit breaks the chain (tamper-evident; not a blockchain).">
      <button class="btn btn-sm" (click)="load(0)">Refresh</button>
    </app-page-header>
    <app-alert [message]="error()" />
    @if (loading()) {<app-loading />}
    @else if (!page()?.content?.length) {<app-empty-state message="No audit events yet." />}
    @else {
      <div class="card tight table-wrap">
        <table class="table compact">
          <thead><tr><th>#</th><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Details</th><th>Prev hash</th><th>Hash</th></tr></thead>
          <tbody>
            @for (e of page()!.content; track e.id) {
              <tr>
                <td>{{ e.id }}</td>
                <td class="nowrap small">{{ e.occurredAt | date:'short' }}</td>
                <td class="small">{{ e.actorName || 'system' }}<div class="muted">{{ e.actorRole | label }}</div></td>
                <td><strong class="small">{{ e.action | label }}</strong></td>
                <td class="small">{{ e.entityType | label }}<div class="muted mono">{{ entityRef(e.entityId) }}</div></td>
                <td class="small"><details><summary class="small">view</summary><pre class="doc" style="max-height:200px">{{ e.details | json }}</pre></details></td>
                <td class="hash">{{ e.previousHash | shortId:12 }}…</td>
                <td class="hash">{{ e.hash | shortId:12 }}…</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="row mt">
        <button class="btn btn-sm" (click)="load(page()!.number - 1)" [disabled]="page()!.number === 0">‹ Newer</button>
        <span class="muted small">Page {{ page()!.number + 1 }} of {{ page()!.totalPages }} · {{ page()!.totalElements }} events</span>
        <button class="btn btn-sm" (click)="load(page()!.number + 1)" [disabled]="page()!.number + 1 >= page()!.totalPages">Older ›</button>
      </div>
    }`,
})
export class AuditLog {
  private api = inject(ApiService);

  /**
   * Seeded ids are of the form 00000000-0000-0000-0000-000000001007, so a prefix renders every
   * row as "00000000". Take the tail instead, which is the part that actually distinguishes them.
   * Hashes keep their prefix, which is the conventional way to show one.
   */
  entityRef(id: string | null | undefined): string {
    if (!id) return '—';
    const flat = id.replace(/-/g, '');
    return flat.length > 8 ? flat.slice(-8) : flat;
  }

  page = signal<Page<AuditEventDto> | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  constructor() { this.load(0); }
  load(n: number): void {
    this.loading.set(true); this.error.set(null);
    this.api.audit(n, 50).subscribe({
      next: (p) => { this.page.set(p); this.loading.set(false); },
      error: (e) => { this.error.set(errMsg(e)); this.loading.set(false); },
    });
  }
}
