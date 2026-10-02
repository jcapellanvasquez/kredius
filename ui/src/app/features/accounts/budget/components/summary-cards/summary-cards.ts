import { ChangeDetectionStrategy, Component, effect, input, output, signal, untracked } from '@angular/core';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { UiIcon } from '../../../../../shared/constants/ui-icons';
import { StatementAccountKind } from '../../budget.enums';
import { BUDGET_TEXT } from '../../budget.texts';
import { CardSummary, SavingsSummary } from '../../models/budget.models';
import { CardDetailsComponent } from '../card-details/card-details';
import { CardSummaryComponent } from '../card-summary/card-summary';
import { SavingsDetailsComponent } from '../savings-details/savings-details';
import { SavingsSummaryComponent } from '../savings-summary/savings-summary';

/**
 * Card and savings summaries side by side, same height, plus one shared full-width details panel
 * below both ("Ver detalles" on either card opens it; the cards themselves never grow).
 */
@Component({
  selector: 'app-summary-cards',
  imports: [IconComponent, CardSummaryComponent, SavingsSummaryComponent, CardDetailsComponent, SavingsDetailsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="grid grid-cols-2 gap-2">
      <app-card-summary [card]="card()" [savingRate]="savingRate()" [rateRequest]="rateRequest()"
        [detailsOpen]="open() === kinds.CreditCard" [detailsId]="panelId"
        (saveRate)="saveRate.emit($event)" (toggleDetails)="toggle(kinds.CreditCard)" />
      <app-savings-summary [savings]="savings()"
        [detailsOpen]="open() === kinds.Savings" [detailsId]="panelId"
        (toggleDetails)="toggle(kinds.Savings)" />

      @if (open(); as kind) {
        <div [id]="panelId" animate.enter="fade-in" class="col-span-2 card p-3" role="region"
          [attr.aria-label]="kind === kinds.CreditCard ? text.cardDetails : text.savingsDetails">
          <div class="flex items-center justify-between gap-2 mb-2">
            <p class="text-sm font-medium text-gray-900">
              {{ kind === kinds.CreditCard ? text.cardDetails : text.savingsDetails }}
            </p>
            <button type="button" (click)="open.set(null)"
              class="inline-flex items-center gap-0.5 text-xs text-gray-500 hover:text-gray-900 transition-colors">
              {{ text.close }}
              <app-icon [name]="icons.ChevronDown" [size]="12" class="rotate-180" />
            </button>
          </div>
          @if (kind === kinds.CreditCard) {
            @if (card().statement; as st) {
              <app-card-details [statement]="st" [usdRate]="card().usdRate" />
            }
          } @else {
            <app-savings-details [savings]="savings()" />
          }
        </div>
      }
    </div>
  `,
})
export class SummaryCardsComponent {
  readonly card = input.required<CardSummary>();
  readonly savings = input.required<SavingsSummary>();
  readonly savingRate = input(false);
  readonly rateRequest = input(0);
  readonly saveRate = output<number>();

  protected readonly text = BUDGET_TEXT;
  protected readonly icons = UiIcon;
  protected readonly kinds = StatementAccountKind;
  protected readonly panelId = 'budget-summary-details';
  /** Which card's details the shared panel shows; null when closed. */
  protected readonly open = signal<StatementAccountKind | null>(null);

  constructor() {
    // A month without a card statement has no card details: close the panel instead of showing it empty.
    effect(() => {
      const hasStatement = !!this.card().statement;
      untracked(() => {
        if (!hasStatement && this.open() === StatementAccountKind.CreditCard) this.open.set(null);
      });
    });
  }

  protected toggle(kind: StatementAccountKind): void {
    this.open.update(current => (current === kind ? null : kind));
  }
}
