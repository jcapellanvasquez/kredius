import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccountIconComponent, AccountIconSize } from '../../../../../shared/components/account-icon/account-icon';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { UiIcon } from '../../../../../shared/constants/ui-icons';
import { ShortDatePipe } from '../../../../../shared/pipes/short-date.pipe';
import { BUDGET_ROUTES, KIND_ICON } from '../../budget.constants';
import { BUDGET_TEXT } from '../../budget.texts';
import { ImportSummary } from '../../models/budget.models';

@Component({
  selector: 'app-upload-history',
  imports: [RouterLink, AccountIconComponent, IconComponent, ShortDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block mt-3 pt-3 border-t border-gray-100' },
  template: `
    <p class="text-xs font-medium text-gray-500 mb-2">{{ text.historyTitle }}</p>
    @if (loading()) {
      <div class="flex flex-col gap-2" aria-busy="true">
        @for (i of skeleton; track i) {
          <div class="h-10 rounded-lg bg-gray-100 animate-pulse"></div>
        }
      </div>
    } @else if (imports().length === 0) {
      <p class="text-xs text-gray-400">{{ text.historyEmpty }}</p>
    } @else {
      <ul class="flex flex-col">
        @for (imp of imports(); track imp.id) {
          <li>
            <a [routerLink]="[routes.importDetail, imp.id]" queryParamsHandling="preserve"
              class="flex items-center gap-2.5 py-2 -mx-1 px-1 rounded-lg hover:bg-gray-50 transition-colors">
              <app-account-icon [icon]="kindIcon[imp.kind]" [size]="iconSize" />
              <div class="flex-1 min-w-0">
                <p class="text-sm text-gray-900 truncate">
                  {{ text.kind[imp.kind] }} · {{ imp.statementDate | shortDate: true }}
                </p>
                <p class="text-xs text-gray-400 truncate">
                  {{ imp.fileName }} · {{ text.lines(imp.lineCount) }}
                  @if (imp.unresolvedCount > 0) { · {{ text.unresolved(imp.unresolvedCount) }} }
                </p>
              </div>
              <span class="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full shrink-0">
                {{ text.importStatus[imp.status] }}
              </span>
              <app-icon [name]="icons.ChevronRight" [size]="14" class="text-gray-300" />
            </a>
          </li>
        }
      </ul>
    }
  `,
})
export class UploadHistoryComponent {
  readonly imports = input<ImportSummary[]>([]);
  readonly loading = input(false);

  protected readonly text = BUDGET_TEXT;
  protected readonly icons = UiIcon;
  protected readonly routes = BUDGET_ROUTES;
  protected readonly kindIcon = KIND_ICON;
  protected readonly iconSize = AccountIconSize.Md;
  protected readonly skeleton = [0, 1, 2];
}
