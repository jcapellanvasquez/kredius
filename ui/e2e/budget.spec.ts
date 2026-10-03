import { Locator, Page, expect, test } from '@playwright/test';
import { CARD_ID, MONTH_PARAM, PRESTAMO } from './fixtures/budget';
import { MockApi } from './support/mock-api';

/**
 * The budget screen at phone and desktop width (projects in playwright.config.ts). Covers the fixes from
 * the phone testing in be/external-files/statament/mobile-fixes-plan.md: A1 "Otra" menu, A2 summary cards,
 * A3 names, A4 rate check, B categorize in place, C text sizes. "Otra" row options: be/external-files/statament/
 * otra-dropdown-plan.md (e2e 1–7).
 */

let api: MockApi;

const isPhone = () => test.info().project.name === 'phone';

async function openBudget(page: Page): Promise<void> {
  api = new MockApi();
  await api.install(page);
  await page.goto(`/accounts/budget?month=${MONTH_PARAM}`);
  await expect(uncategorizedTitle(page)).toBeVisible();
}

/** The "Sin categorizar (n)" title; `count` checks the number too. */
const uncategorizedTitle = (page: Page, count?: number) =>
  page.locator('p').filter({ hasText: count === undefined ? /Sin categorizar \(\d+\)/ : `Sin categorizar (${count})` });
const row = (page: Page, text: string) => page.locator('app-transaction-row').filter({ hasText: text });
/**
 * Distance from the "Sin categorizar" title: the row's place in the list. Viewport positions change when
 * Playwright scrolls to click (inside the layout's scroll container on phones, so window.scrollY stays 0).
 */
const topInList = async (page: Page, locator: Locator) =>
  (await box(locator)).y - (await box(uncategorizedTitle(page))).y;
/** Opens "Otra" on a row and returns its list. */
async function openOther(line: Locator): Promise<Locator> {
  await line.getByRole('button', { name: 'Otra' }).click();
  return line.locator('app-category-chips ul');
}
/** The group headers of an open "Otra" list, in order. */
const groupsOf = (list: Locator) => list.locator('li[role="presentation"]').allInnerTexts();
const box = async (locator: Locator) => {
  const b = await locator.boundingBox();
  expect(b, 'element is on the page').not.toBeNull();
  return b!;
};

test.beforeEach(async ({ page }) => openBudget(page));

test.afterEach(async ({ page }, info) => {
  await info.attach('screen', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  expect(api.unhandled, 'API calls the mock doesn\'t answer').toEqual([]);
});

test('nothing on the screen is wider than the viewport', async ({ page }) => {
  const { scroll, viewport } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth, viewport: window.innerWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(viewport);
});

test('A1: the "Otra" menu opens inside the screen', async ({ page }) => {
  const viewport = page.viewportSize()!;
  for (const text of ['Pago Intereses CA', 'Google YouTube']) {
    await row(page, text).getByRole('button', { name: 'Otra' }).click();
    const panel = page.getByRole('combobox', { name: 'Buscar cuenta' }).locator('xpath=ancestor::div[contains(@class, "absolute")][1]');
    const b = await box(panel);
    expect(b.x, `${text}: left edge`).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width, `${text}: right edge`).toBeLessThanOrEqual(viewport.width);
    await page.keyboard.press('Escape');
  }
});

test('A2: summary cards stack on phones, details open under the card that opened them', async ({ page }) => {
  const card = page.locator('app-card-summary');
  const savings = page.locator('app-savings-summary');
  const [c, s] = [await box(card), await box(savings)];
  if (isPhone()) {
    expect(s.y, 'savings below the card').toBeGreaterThanOrEqual(c.y + c.height - 1);
    expect(Math.abs(s.x - c.x)).toBeLessThan(2);
  } else {
    expect(Math.abs(s.y - c.y), 'side by side').toBeLessThan(2);
  }

  await card.getByRole('button', { name: /Ver detalles/ }).click();
  const panel = page.getByRole('region', { name: 'Detalles de la tarjeta' });
  const p = await box(panel);
  const s2 = await box(savings);
  if (isPhone()) {
    expect(p.y, 'panel under the card').toBeGreaterThanOrEqual(c.y + c.height - 1);
    expect(p.y + p.height, 'panel above savings').toBeLessThanOrEqual(s2.y + 1);
  } else {
    expect(p.y, 'panel below both cards').toBeGreaterThanOrEqual(Math.max(c.y + c.height, s2.y + s2.height) - 1);
  }
});

test('A3: long descriptions use up to 2 lines and open in full on tap', async ({ page }) => {
  const description = row(page, '818700000').getByRole('button', { name: /Imp\. transferencia/ });
  await expect(description).toHaveAttribute('aria-expanded', 'false');
  await expect(description).toHaveClass(/line-clamp-2/);
  await description.click();
  await expect(description).toHaveAttribute('aria-expanded', 'true');
  await expect(description).not.toHaveClass(/line-clamp-2/);
});

test('A4: a rate far from the last one asks before saving', async ({ page }) => {
  const card = page.locator('app-card-summary');
  await card.getByRole('button', { name: 'cambiar', exact: true }).click();
  await card.getByLabel('Tasa US$').fill('6140');
  await card.getByRole('button', { name: 'Guardar', exact: true }).click();

  await expect(card.getByRole('alert')).toContainText('¿Seguro?');
  expect(api.writes(/exchange-rates/), 'nothing saved before confirming').toEqual([]);

  await card.getByRole('button', { name: 'Sí, guardar' }).click();
  await expect.poll(() => api.writes(/exchange-rates/).map(c => c.body)).toEqual([{ value: 6140 }]);
});

test('A4: a usual rate saves right away, rounded to 2 decimals', async ({ page }) => {
  const card = page.locator('app-card-summary');
  await card.getByRole('button', { name: 'cambiar', exact: true }).click();
  await card.getByLabel('Tasa US$').fill('62.305');
  await card.getByLabel('Tasa US$').press('Enter');
  await expect.poll(() => api.writes(/exchange-rates/).map(c => c.body)).toEqual([{ value: 62.31 }]);
});

test('B: a categorized line stays in place as a confirmation row; "Cambiar" recategorizes', async ({ page }) => {
  const line = row(page, 'SUPERMERCADO PLAZA CENTRAL');
  const before = await topInList(page, line);
  await expect(uncategorizedTitle(page, 6)).toBeVisible();

  await line.getByRole('button', { name: 'Supermercado', exact: true }).click();
  const confirmation = line.getByRole('status');
  await expect(confirmation).toContainText('→ Supermercado');
  await expect(uncategorizedTitle(page, 5), 'the count leaves it out').toBeVisible();
  expect(Math.abs(await topInList(page, line) - before), 'the row didn\'t move').toBeLessThan(2);
  expect(api.writes(/statement-lines\/102$/)).toHaveLength(1);

  await line.getByRole('button', { name: 'Cambiar', exact: true }).click();
  await line.getByRole('button', { name: 'Hogar', exact: true }).click();
  await expect(line.getByRole('status')).toContainText('→ Hogar');
  expect(api.writes(/statement-lines\/102\/recategorize$/), 'Cambiar recategorizes').toHaveLength(1);
  expect(api.writes(/statement-lines\/102$/), 'no second categorize').toHaveLength(1);
});

test('C: text is 16px on phones and 14px on desktop; inputs are 16px on phones', async ({ page }) => {
  const fontSize = (locator: Locator) => locator.evaluate(el => getComputedStyle(el).fontSize);
  const description = row(page, 'SUPERMERCADO PLAZA CENTRAL').getByRole('button', { name: /SUPERMERCADO/ });
  const budgetInput = page.locator('app-budget-input input').first();

  expect(await fontSize(description)).toBe(isPhone() ? '16px' : '14px');
  expect(await fontSize(budgetInput)).toBe(isPhone() ? '16px' : '14px');
});

test('A3: quick compare doesn\'t break a name mid-word next to a long amount (phone)', async ({ page }) => {
  test.skip(!isPhone(), 'phone layout only');
  const name = page.locator('app-quick-compare').getByText('Supermercados y colmados del barrio');
  const lineHeight = await name.evaluate(el => parseFloat(getComputedStyle(el).lineHeight));
  // Fits on one line at full width; squeezed by the amount it broke as "Supermercado / s y colmados…".
  expect((await box(name)).height).toBeLessThan(lineHeight * 1.5);
});

test('savings: the month-over-month change reads "… vs julio" with a space', async ({ page }) => {
  await expect(page.locator('app-savings-summary')).toContainText(/\d vs julio/);
});

test('Otra 1: a savings payment out offers "Entre mis cuentas" with the card; picking it posts to the card', async ({ page }) => {
  const line = row(page, 'PAGO DE TC');
  const list = await openOther(line);
  expect(await groupsOf(list)).toEqual(['Entre mis cuentas', 'Gastos']);
  await list.getByRole('option', { name: /Tarjeta/ }).click();
  await expect.poll(() => api.writes(/statement-lines\/106$/).map(c => c.body)).toEqual([{ categoryAccountId: CARD_ID }]);
});

test('Otra 2: a card purchase offers only Gastos, never the card', async ({ page }) => {
  const list = await openOther(row(page, 'Google YouTube'));
  expect(await groupsOf(list)).toEqual(['Gastos']);
  await expect(list.getByRole('option', { name: /Tarjeta|Salario|Préstamo/ })).toHaveCount(0);
});

test('Otra 3: savings money in offers only Ingresos', async ({ page }) => {
  const list = await openOther(row(page, 'Pago Intereses CA'));
  expect(await groupsOf(list)).toEqual(['Ingresos']);
  await expect(list.getByRole('option', { name: /Supermercado|Tarjeta/ })).toHaveCount(0);
});

test('Otra 4: a search lists one flat list with each kind; other accounts come last under "Otras cuentas"', async ({ page }) => {
  const savingsOut = row(page, 'PAGO DE TC');
  let list = await openOther(savingsOut);
  await savingsOut.getByRole('combobox', { name: 'Buscar cuenta' }).fill('pago');
  expect(await groupsOf(list), 'no group headers while searching').toEqual([]);
  await expect(list.getByRole('option')).toHaveText([/Tarjeta\s*Pago de tarjeta/, /Préstamo vehículo\s*Pago de préstamo/]);
  await page.keyboard.press('Escape');

  const cardPurchase = row(page, 'Google YouTube');
  list = await openOther(cardPurchase);
  const search = cardPurchase.getByRole('combobox', { name: 'Buscar cuenta' });
  await search.fill('salario');
  expect(await groupsOf(list)).toEqual(['Otras cuentas']);
  await expect(list.getByRole('option')).toHaveText([/Salario\s*Ingreso/]);
  await search.fill('tarjeta');
  await expect(list, 'the card is never offered on a card row').toHaveText('Sin resultados');
});

test('Otra 5: on phones the panel is as wide as the row and options are 44px tall; 340px on desktop', async ({ page }) => {
  const line = row(page, 'PAGO DE TC');
  const list = await openOther(line);
  const panel = line.locator('app-category-chips div.absolute');
  const [p, chips] = [await box(panel), await box(line.locator('app-category-chips'))];
  if (isPhone()) {
    expect(Math.abs(p.x - chips.x), 'left edge').toBeLessThan(1);
    expect(Math.abs(p.width - chips.width), 'width').toBeLessThan(1);
  } else {
    expect(p.width).toBe(340);
  }
  for (const option of await list.getByRole('option').all()) {
    expect((await box(option)).height).toBeGreaterThanOrEqual(isPhone() ? 44 : 34);
  }
});

test('Otra 6: the search gets focus; ↓ ↓ Enter picks the second option; Esc closes and focuses "Otra"', async ({ page }) => {
  const line = row(page, 'PAGO DE TC');
  const other = line.getByRole('button', { name: 'Otra' });
  await openOther(line);
  const search = line.getByRole('combobox', { name: 'Buscar cuenta' });
  await expect(search).toBeFocused();
  await expect(line.getByText('↑↓ moverse')).toBeVisible({ visible: !isPhone() });

  await page.keyboard.press('Escape');
  await expect(search).toHaveCount(0);
  await expect(other).toBeFocused();

  await openOther(line);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  const active = await search.getAttribute('aria-activedescendant');
  await expect(line.locator(`[id="${active}"]`)).toHaveAttribute('role', 'option');
  await expect(line.locator(`[id="${active}"]`)).toContainText('Préstamo vehículo');
  await page.keyboard.press('Enter');
  await expect.poll(() => api.writes(/statement-lines\/106$/).map(c => c.body)).toEqual([{ categoryAccountId: PRESTAMO }]);
});

test('Otra 7: "Cambiar" on a categorized row offers the same groups', async ({ page }) => {
  const line = row(page, 'PAGO DE TC');
  await (await openOther(line)).getByRole('option', { name: /Comisiones/ }).click();
  await expect(line.getByRole('status')).toContainText('→ Comisiones bancarias');

  await line.getByRole('button', { name: 'Cambiar', exact: true }).click();
  const list = await openOther(line);
  expect(await groupsOf(list)).toEqual(['Entre mis cuentas', 'Gastos']);
  await list.getByRole('option', { name: /Tarjeta/ }).click();
  await expect(line.getByRole('status')).toContainText('→ Tarjeta');
  await expect.poll(() => api.writes(/statement-lines\/106\/recategorize$/).map(c => c.body))
    .toEqual([{ categoryAccountId: CARD_ID }]);
});
