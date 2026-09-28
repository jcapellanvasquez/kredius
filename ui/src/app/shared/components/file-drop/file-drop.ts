import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { IconComponent } from '../icon/icon';
import { SHARED_TEXT } from '../../constants/shared-texts';
import { UiIcon } from '../../constants/ui-icons';

/** Dashed file slot. The parent owns the selected file; this component only reports picks and clears. */
@Component({
  selector: 'app-file-drop',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="relative h-full rounded-lg border-[1.5px] border-dashed px-2 py-3 text-center transition-colors"
      [class.border-gray-200]="!file()" [class.border-gray-900]="!!file()" [class.opacity-50]="disabled()">
      <label class="flex flex-col items-center gap-1 cursor-pointer" [class.cursor-not-allowed]="disabled()">
        <input #input type="file" class="sr-only" [accept]="accept()" [disabled]="disabled()"
          [attr.aria-label]="label() + ' — ' + text.chooseFile" (change)="onPick(input)" />
        <app-icon [name]="file() ? icons.FileText : icons.FileUpload" [size]="20" class="text-brand-500" />
        <span class="text-xs font-medium text-gray-700">{{ label() }}</span>
        @if (file(); as f) {
          <span class="text-xs text-gray-900 truncate max-w-full">{{ f.name }}</span>
        } @else if (hint()) {
          <span class="text-xs text-gray-400">{{ hint() }}</span>
        }
      </label>
      @if (file() && !disabled()) {
        <button type="button" (click)="clear()" [attr.aria-label]="text.removeFile"
          class="absolute top-1 right-1 p-1 text-gray-400 hover:text-gray-700 rounded">
          <app-icon [name]="icons.Close" [size]="14" />
        </button>
      }
    </div>
  `,
})
export class FileDropComponent {
  readonly label = input.required<string>();
  readonly hint = input<string | null>(null);
  readonly accept = input('');
  readonly file = input<File | null>(null);
  readonly disabled = input(false);
  readonly fileChange = output<File | null>();

  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('input');
  protected readonly text = SHARED_TEXT;
  protected readonly icons = UiIcon;

  protected onPick(el: HTMLInputElement): void {
    this.fileChange.emit(el.files?.[0] ?? null);
  }

  protected clear(): void {
    const el = this.inputRef()?.nativeElement;
    if (el) el.value = '';
    this.fileChange.emit(null);
  }
}
