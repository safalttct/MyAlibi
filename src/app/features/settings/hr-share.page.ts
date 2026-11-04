import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideCopy, LucideLink, LucideRefreshCw, LucideShieldOff } from '@lucide/angular';
import { HrShareLink, HrShareService } from '../../core/services/hr-share.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeader } from '../../shared/components/page-header';
import { SettingsTabs } from '../../shared/components/settings-tabs';
import { UiButton } from '../../shared/ui/ui-button';
import { UiCard } from '../../shared/ui/ui-card';
import { UiConfirmDialog } from '../../shared/ui/ui-confirm-dialog';
import { UiField } from '../../shared/ui/ui-field';
import { UiInput } from '../../shared/ui/ui-input';
import { UiSelect } from '../../shared/ui/ui-select';
import { UiSkeleton } from '../../shared/ui/ui-skeleton';

@Component({
  selector: 'app-hr-share-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    PageHeader,
    SettingsTabs,
    UiCard,
    UiButton,
    UiField,
    UiInput,
    UiSelect,
    UiSkeleton,
    UiConfirmDialog,
    LucideCopy,
    LucideLink,
    LucideRefreshCw,
    LucideShieldOff,
  ],
  template: `
    <app-page-header eyebrow="Settings" title="Share to HR" subtitle="Share a view-only link with HR" />
    <app-settings-tabs class="mb-5 sm:mb-6" />

    <div class="grid max-w-2xl gap-4">
      <ui-card
        title="Share to HR"
        description="Generate a public link so HR can cross-check leave and WFH for the current financial year. View only — no sign-in, no edits."
      >
        @if (loading()) {
          <ui-skeleton class="h-36" />
        } @else if (link(); as active) {
          <div class="grid gap-4">
            <ui-field label="Public link">
              <div class="flex flex-col gap-2 sm:flex-row">
                <input uiInput type="text" class="flex-1" readonly [value]="shareUrl()" />
                <button uiButton type="button" class="max-sm:w-full" (click)="copyLink()">
                  <svg lucideCopy size="14"></svg> Copy
                </button>
              </div>
            </ui-field>
            <dl class="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt class="text-xs text-muted">Created</dt>
                <dd class="font-medium text-foreground">{{ active.created_at | date: 'medium' }}</dd>
              </div>
              <div>
                <dt class="text-xs text-muted">Expires</dt>
                <dd class="font-medium text-foreground">
                  {{ active.expires_at ? (active.expires_at | date: 'mediumDate') : 'Never' }}
                </dd>
              </div>
              <div>
                <dt class="text-xs text-muted">Last opened</dt>
                <dd class="font-medium text-foreground">
                  {{ active.last_accessed_at ? (active.last_accessed_at | date: 'medium') : 'Not yet' }}
                </dd>
              </div>
            </dl>
            <div class="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                uiButton
                variant="outline"
                type="button"
                class="max-sm:w-full"
                [loading]="working()"
                (click)="confirmRotate.set(true)"
              >
                <svg lucideRefreshCw size="14"></svg> Rotate link
              </button>
              <button
                uiButton
                variant="danger"
                type="button"
                class="max-sm:w-full"
                [loading]="working()"
                (click)="confirmRevoke.set(true)"
              >
                <svg lucideShieldOff size="14"></svg> Revoke
              </button>
            </div>
          </div>
        } @else {
          <div class="grid gap-4">
            <p class="text-sm text-muted">
              No active link. Create one when you want HR to review your current-year leave and WFH
              against their records.
            </p>
            <ui-field label="Link expires after">
              <select uiSelect [(ngModel)]="expiryDays">
                <option [ngValue]="7">7 days</option>
                <option [ngValue]="30">30 days</option>
                <option [ngValue]="90">90 days</option>
                <option [ngValue]="null">Never (until revoked)</option>
              </select>
            </ui-field>
            <div class="flex justify-end">
              <button
                uiButton
                type="button"
                class="max-sm:w-full"
                [loading]="working()"
                (click)="create()"
              >
                <svg lucideLink size="14"></svg> Create share link
              </button>
            </div>
          </div>
        }
      </ui-card>

      <ui-card title="What HR can see">
        <ul class="list-disc space-y-1.5 pl-5 text-sm text-muted">
          <li>Your display name</li>
          <li>Current financial year balances (used / remaining)</li>
          <li>Leave and WFH records for that year (date, type, duration)</li>
          <li>No notes, no login, no ability to change anything</li>
        </ul>
      </ui-card>
    </div>

    <ui-confirm-dialog
      [open]="confirmRevoke()"
      title="Revoke share link?"
      message="HR will immediately lose access. You can create a new link later."
      confirmLabel="Revoke"
      (cancelled)="confirmRevoke.set(false)"
      (confirmed)="revoke()"
    />
    <ui-confirm-dialog
      [open]="confirmRotate()"
      title="Rotate share link?"
      message="The old link stops working and a new one is created. Copy the new link for HR."
      confirmLabel="Rotate"
      (cancelled)="confirmRotate.set(false)"
      (confirmed)="rotate()"
    />
  `,
})
export class HrSharePage {
  private readonly shares = inject(HrShareService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly working = signal(false);
  protected readonly link = signal<HrShareLink | null>(null);
  protected readonly shareUrl = signal('');
  protected readonly confirmRevoke = signal(false);
  protected readonly confirmRotate = signal(false);
  protected expiryDays: number | null = 30;

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const active = await this.shares.getActiveLink();
      this.link.set(active);
      this.shareUrl.set(active ? this.shares.publicUrl(active.token) : '');
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Could not load share link.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async create(): Promise<void> {
    if (this.working()) {
      return;
    }
    this.working.set(true);
    try {
      const created = await this.shares.createLink(this.expiryDays);
      this.link.set(created);
      this.shareUrl.set(this.shares.publicUrl(created.token));
      await this.copyLink();
      this.toast.success('Share link created and copied');
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Could not create share link.');
    } finally {
      this.working.set(false);
    }
  }

  protected async rotate(): Promise<void> {
    this.confirmRotate.set(false);
    await this.create();
  }

  protected async revoke(): Promise<void> {
    this.confirmRevoke.set(false);
    const active = this.link();
    if (!active || this.working()) {
      return;
    }
    this.working.set(true);
    try {
      await this.shares.revokeLink(active.id);
      this.link.set(null);
      this.shareUrl.set('');
      this.toast.success('Share link revoked');
    } catch (e) {
      this.toast.error(e instanceof Error ? e.message : 'Could not revoke share link.');
    } finally {
      this.working.set(false);
    }
  }

  protected async copyLink(): Promise<void> {
    const url = this.shareUrl();
    if (!url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      this.toast.success('Link copied');
    } catch {
      this.toast.error('Could not copy — select the link and copy manually.');
    }
  }
}
