import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AccountApiService } from '../../account-api.service';
import { MIN_SAVING_MS } from '../budget.constants';
import { CurrencyCode, LineStatus, SaveState, StatementAccountKind } from '../budget.enums';
import { BudgetApi } from '../data/budget-api';
import { BudgetScreen, TransactionLine } from '../models/budget.models';
import { BudgetStore } from './budget-store';

const SUPERMERCADO = 7;
const HOGAR = 8;

function line(lineId: number, description: string): TransactionLine {
  return {
    lineId, description, date: '2026-08-28', amount: 100, currency: CurrencyCode.Rd, originalAmount: 100,
    source: StatementAccountKind.Savings, sourceIcon: 'building-bank', status: LineStatus.Pending,
    categoryId: null, categoryName: null, suggestions: [],
  };
}

/** Only what "Sin categorizar" reads; the rest of the screen isn't touched by these tests. */
function screenWith(uncategorized: TransactionLine[]): BudgetScreen {
  return { uncategorized, categories: [], loanOptions: [], incomeOptions: [], lastUploads: [] } as unknown as BudgetScreen;
}

describe('BudgetStore: categorizing from "Sin categorizar" (B, categorize in place)', () => {
  const a = line(1, 'SUPERMERCADO PZA VALERIO');
  const b = line(2, 'Imp. transferencia');
  const c = line(3, 'PAGO DE TC');
  let api: jasmine.SpyObj<BudgetApi>;
  let store: BudgetStore;

  /** What the server lists on the next load (a categorized line is no longer pending there). */
  function serverLists(lines: TransactionLine[]): void {
    api.getScreen.and.returnValue(of(screenWith(lines)));
  }

  beforeEach(() => {
    api = jasmine.createSpyObj<BudgetApi>('BudgetApi', ['getScreen', 'getCategoryOptions', 'categorize', 'recategorize']);
    api.getCategoryOptions.and.returnValue(of([]));
    api.categorize.and.returnValue(of(undefined));
    api.recategorize.and.returnValue(of(undefined));
    serverLists([a, b, c]);

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        BudgetStore,
        { provide: BudgetApi, useValue: api },
        { provide: AccountApiService, useValue: { load: () => of(undefined) } },
      ],
    });
    store = TestBed.inject(BudgetStore);
    store.init();
  });

  it('keeps the line in place as a confirmation row, posted with its new category', fakeAsync(() => {
    serverLists([b, c]);
    store.chooseCategory(a, SUPERMERCADO);
    tick(MIN_SAVING_MS);

    expect(store.uncategorized().map(l => l.lineId)).toEqual([1, 2, 3]);
    expect(store.doneLineIds().has(1)).toBeTrue();
    const kept = store.uncategorized()[0];
    expect(kept.status).toBe(LineStatus.Posted);
    expect(kept.categoryId).toBe(SUPERMERCADO);
    // No "Guardado" on the chips: the confirmation row is the feedback.
    expect(store.lineState(1)).toBeUndefined();
  }));

  it('only pending lines count', fakeAsync(() => {
    serverLists([b, c]);
    store.chooseCategory(a, SUPERMERCADO);
    tick(MIN_SAVING_MS);

    const pending = store.uncategorized().filter(l => !store.doneLineIds().has(l.lineId));
    expect(pending.map(l => l.lineId)).toEqual([2, 3]);
  }));

  it('"Cambiar" recategorizes the kept line instead of categorizing it again', fakeAsync(() => {
    serverLists([b, c]);
    store.chooseCategory(a, SUPERMERCADO);
    tick(MIN_SAVING_MS);

    store.chooseCategory(store.uncategorized()[0], HOGAR);
    tick(MIN_SAVING_MS);

    expect(api.categorize).toHaveBeenCalledTimes(1);
    expect(api.recategorize).toHaveBeenCalledOnceWith(1, HOGAR);
    expect(store.uncategorized()[0].categoryId).toBe(HOGAR);
    expect(store.uncategorized().map(l => l.lineId)).toEqual([1, 2, 3]);
  }));

  it('the kept copy wins when the server still lists the line', fakeAsync(() => {
    store.chooseCategory(a, SUPERMERCADO); // server keeps listing a, b, c
    tick(MIN_SAVING_MS);

    expect(store.uncategorized().map(l => l.lineId)).toEqual([1, 2, 3]);
    expect(store.uncategorized()[0].status).toBe(LineStatus.Posted);
  }));

  it('a failed save leaves the row open with its error', fakeAsync(() => {
    api.categorize.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    store.chooseCategory(a, SUPERMERCADO);
    tick(MIN_SAVING_MS);

    expect(store.doneLineIds().size).toBe(0);
    expect(store.lineState(1)?.state).toBe(SaveState.Error);
  }));

  it('changing month clears the confirmation rows', fakeAsync(() => {
    serverLists([b, c]);
    store.chooseCategory(a, SUPERMERCADO);
    tick(MIN_SAVING_MS);

    store.changePeriod('2026-09-01');
    tick();

    expect(store.doneLineIds().size).toBe(0);
    expect(store.uncategorized().map(l => l.lineId)).toEqual([2, 3]);
  }));
});
