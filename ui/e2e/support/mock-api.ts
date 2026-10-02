import { Page, Route } from '@playwright/test';
import { ACCOUNTS_SUMMARY, ALL_ACCOUNTS, EXPENSE_ACCOUNTS, UNCATEGORIZED, budgetScreen } from '../fixtures/budget';

/** A write the page sent, for assertions ("Cambiar" recategorizes, a confirmed rate is saved…). */
export interface ApiCall {
  method: string;
  path: string;
  body: unknown;
}

/**
 * Answers every `/api/v1/**` call of the budget screen like the backend would, with state: a line
 * categorized through PATCH leaves "Sin categorizar" on the next load. Unknown calls get a 501 and are
 * listed in `unhandled`, so a test can fail on them instead of hiding a missing mock.
 */
export class MockApi {
  readonly calls: ApiCall[] = [];
  readonly unhandled: string[] = [];
  private readonly categorized = new Set<number>();

  async install(page: Page): Promise<void> {
    await page.route(url => url.pathname.startsWith('/api/v1/'), route => this.handle(route));
  }

  /** The writes sent so far, optionally only those to paths matching `path`. */
  writes(path?: RegExp): ApiCall[] {
    return this.calls.filter(c => c.method !== 'GET' && (!path || path.test(c.path)));
  }

  private async handle(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname;
    if (method !== 'GET') this.calls.push({ method, path, body: request.postDataJSON() as unknown });

    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (method === 'GET' && path === '/api/v1/budget-screen') {
      return json(budgetScreen(UNCATEGORIZED.filter(l => !this.categorized.has(l.lineId))));
    }
    if (method === 'GET' && path === '/api/v1/accounts/summary') return json(ACCOUNTS_SUMMARY);
    if (method === 'GET' && path === '/api/v1/accounts') {
      return json(url.searchParams.get('type') === 'EXPENSE' ? EXPENSE_ACCOUNTS : ALL_ACCOUNTS);
    }
    if (method === 'GET' && path === '/api/v1/statement-imports') return json([]);

    const patchLine = /^\/api\/v1\/statement-lines\/(\d+)$/.exec(path);
    if (method === 'PATCH' && patchLine) {
      this.categorized.add(Number(patchLine[1]));
      return json({ id: Number(patchLine[1]) });
    }
    if (method === 'POST' && /^\/api\/v1\/statement-lines\/\d+\/recategorize$/.test(path)) return json({});
    if (method === 'POST' && path === '/api/v1/exchange-rates') {
      const { value } = request.postDataJSON() as { value: number };
      return json({ value, rateDate: '2026-10-02', postedLines: 0 });
    }

    this.unhandled.push(`${method} ${path}`);
    return route.fulfill({ status: 501, body: `Not mocked: ${method} ${path}` });
  }
}
