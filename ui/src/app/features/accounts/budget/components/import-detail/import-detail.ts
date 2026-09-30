import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AccountIconComponent, AccountIconSize } from '../../../../../shared/components/account-icon/account-icon';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { UiIcon } from '../../../../../shared/constants/ui-icons';
import { MoneyPipe } from '../../../../../shared/pipes/money.pipe';
import { ShortDatePipe } from '../../../../../shared/pipes/short-date.pipe';
import { BUDGET_ROUTES, KIND_ICON } from '../../budget.constants';
import { BUDGET_TEXT } from '../../budget.texts';
import { BudgetApi } from '../../data/budget-api';
import { ImportDetail } from '../../models/budget.models';

/** Read-only view of one past upload (route `accounts/budget/imports/:id`). */
@Component({
  selector: 'app-import-detail',
  imports: [RouterLink, AccountIconComponent, IconComponent, MoneyPipe, ShortDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="max-w-2xl mx-auto flex flex-col gap-4">
      <a [routerLink]="routes.root" queryParamsHandling="preserve"
        class="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 transition-colors w-fit">
        <app-icon [name]="icons.ArrowLeft" [size]="16" /> {{ text.back }}
      </a>

      @if (loading()) {
        <div class="h-20 rounded-lg bg-gray-100 animate-pulse" aria-busy="true"></div>
        <div class="h-64 rounded-lg bg-gray-100 animate-pulse"></div>
      } @else if (detail(); as d) {
        <div class="card p-3.5 flex items-center gap-3">
          <app-account-icon [icon]="kindIcon[d.kind]" [size]="iconSize" />
          <div class="flex-1 min-w-0">
            <h1 class="text-base font-semibold text-gray-900">
              {{ text.kind[d.kind] }} · {{ d.statementDate | shortDate: true }}
            </h1>
            <p class="text-xs text-gray-400 truncate">{{ d.fileName }} · {{ text.lines(d.lineCount) }}</p>
          </div>
          <span class="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full shrink-0">
            {{ text.importStatus[d.status] }}
          </span>
        </div>

        <section>
          <h2 class="text-sm font-medium text-gray-500 mb-2">{{ text.importLines }}</h2>
          <ul class="card">
            @for (line of d.lines; track line.lineId) {
              <li class="card-row gap-3">
                <div class="min-w-0">
                  <p class="text-sm text-gray-700 truncate">{{ line.date | shortDate }} · {{ line.description }}</p>
                  <p class="text-xs text-gray-400">{{ line.categoryName ?? text.uncategorized }}</p>
                </div>
                <span class="text-sm text-gray-900 tabular-nums shrink-0">{{ line.amount | money: 2 }}</span>
              </li>
            }
          </ul>
        </section>
      } @else {
        <p class="text-sm text-gray-500" role="alert">{{ text.importNotFound }}</p>
      }
    </div>
  `,
})
export class ImportDetailComponent implements OnInit {
  /** Route param, bound via `withComponentInputBinding()`. */
  readonly id = input.required<string>();

  private readonly api = inject(BudgetApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly text = BUDGET_TEXT;
  protected readonly icons = UiIcon;
  protected readonly routes = BUDGET_ROUTES;
  protected readonly kindIcon = KIND_ICON;
  protected readonly iconSize = AccountIconSize.Lg;
  protected readonly loading = signal(true);
  protected readonly detail = signal<ImportDetail | null>(null);

  ngOnInit(): void {
    this.api.getImport(Number(this.id()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: d => { this.detail.set(d); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
  }
}
