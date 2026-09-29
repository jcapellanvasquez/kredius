import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FileDropComponent } from '../../../../../shared/components/file-drop/file-drop';
import { IconComponent } from '../../../../../shared/components/icon/icon';
import { UiIcon } from '../../../../../shared/constants/ui-icons';
import { STATEMENT_FILE_ACCEPT, STATEMENT_KIND_ORDER } from '../../budget.constants';
import { StatementAccountKind } from '../../budget.enums';
import { BUDGET_TEXT } from '../../budget.texts';
import { LastUpload } from '../../models/budget.models';

export interface FilePick {
  kind: StatementAccountKind;
  file: File | null;
}

/** Two optional statement slots + "Procesar". Upload history is projected below via `<ng-content>`. */
@Component({
  selector: 'app-upload-panel',
  imports: [FileDropComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="card p-3.5">
      <div class="grid grid-cols-2 gap-2 mb-2.5">
        @for (slot of slots(); track slot.kind) {
          <app-file-drop
            [label]="text.kindLong[slot.kind]"
            [hint]="text.lastUpload(slot.uploadedAt)"
            [accept]="accept"
            [file]="files()[slot.kind] ?? null"
            [disabled]="uploading()"
            (fileChange)="fileChange.emit({ kind: slot.kind, file: $event })" />
        }
      </div>
      <p class="text-xs text-gray-400 mb-2.5">{{ text.uploadHint }}</p>

      <div class="flex items-center gap-2 mb-2.5">
        <label [for]="dateId" class="text-sm text-gray-500 shrink-0">{{ text.statementDate }}</label>
        <input [id]="dateId" type="date" [value]="statementDate()" [disabled]="uploading()"
          (change)="onDateChange($event)"
          class="flex-1 min-w-0 px-3 py-1.5 text-sm text-gray-900 tabular-nums bg-white rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:bg-gray-50" />
      </div>

      @if (error()) {
        <p class="flex items-center gap-1 text-xs text-gray-900 mb-2.5" role="alert">
          <app-icon [name]="icons.Alert" [size]="14" /> {{ text.uploadError }}
        </p>
      }

      <button type="button" (click)="process.emit()" [disabled]="!canProcess()"
        class="w-full inline-flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
        @if (uploading()) {
          <app-icon [name]="icons.Loader" [size]="16" class="animate-spin" />
          {{ text.processing }}
        } @else {
          {{ text.process }}
        }
      </button>

      <button type="button" (click)="toggleHistory.emit()" [attr.aria-expanded]="historyOpen()"
        class="mt-3 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition-colors">
        <app-icon [name]="icons.History" [size]="14" />
        {{ text.history }}
        <app-icon [name]="icons.ChevronDown" [size]="12" class="transition-transform" [class.rotate-180]="historyOpen()" />
      </button>

      <ng-content />
    </div>
  `,
})
export class UploadPanelComponent {
  readonly lastUploads = input<LastUpload[]>([]);
  readonly files = input<Partial<Record<StatementAccountKind, File>>>({});
  readonly statementDate = input('');
  readonly uploading = input(false);
  readonly canProcess = input(false);
  readonly error = input(false);
  readonly historyOpen = input(false);

  readonly fileChange = output<FilePick>();
  readonly statementDateChange = output<string>();
  readonly process = output<void>();
  readonly toggleHistory = output<void>();

  protected readonly text = BUDGET_TEXT;
  protected readonly icons = UiIcon;
  protected readonly accept = STATEMENT_FILE_ACCEPT;
  protected readonly dateId = 'statement-date';

  protected readonly slots = computed(() =>
    STATEMENT_KIND_ORDER.map(kind => ({
      kind,
      uploadedAt: this.lastUploads().find(u => u.kind === kind)?.uploadedAt ?? null,
    })),
  );

  protected onDateChange(event: Event): void {
    this.statementDateChange.emit((event.target as HTMLInputElement).value);
  }
}
