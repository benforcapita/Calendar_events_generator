import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const storageKey = 'ces_events_v1';
test.beforeEach(async ({ page }) => { await page.goto('/'); });
test('complete create/edit/search/persist/download/import/delete journey', async ({ page }, info) => {
  const foreignRequests: string[] = [], errors: string[] = [];
  page.on('request', req => { if (!req.url().startsWith('http://127.0.0.1:4193')) foreignRequests.push(req.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('button', { name: 'Try an example' }).click();
  await page.getByLabel('Event title').fill('Review, café; 東京 🗓️');
  await page.getByLabel('Notes optional').fill('First line\nBEGIN:VEVENT\nATTENDEE:mailto:nobody@example.test');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  let card = page.getByRole('article', { name: 'Review, café; 東京 🗓️', exact: true });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Event title').fill('Updated café plan');
  await page.getByRole('button', { name: 'Save changes' }).click();
  card = page.getByRole('article', { name: 'Updated café plan', exact: true });
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Event title').fill('Unsaved title');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Cancel editing' }).click();
  await expect(page.getByLabel('Event title')).toHaveValue('Unsaved title');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Cancel editing' }).click();
  await page.getByLabel('Search events').fill('absent');
  await expect(page.getByText('No matching events')).toBeVisible();
  await page.getByLabel('Search events').fill('');
  await page.reload();
  await expect(card).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await card.getByRole('button', { name: 'Download ICS' }).click();
  const download = await downloadEvent;
  const path = info.outputPath('event.ics'); await download.saveAs(path);
  const content = await readFile(path, 'utf8');
  expect(content).toContain('SUMMARY:Updated café plan');
  expect(content.match(/^BEGIN:VEVENT$/gm)).toHaveLength(1);
  expect(content).not.toMatch(/^ATTENDEE:/m);
  await page.getByLabel('Import calendar file').setInputFiles(path);
  await expect(page.getByRole('region', { name: 'Review import' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel import' }).click();
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByLabel('Import calendar file').setInputFiles(path);
  await page.getByRole('button', { name: 'Add imported events' }).click();
  await expect(page.getByRole('status')).toContainText('Imported 0 events. 1 existing UID skipped');
  await card.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo delete' }).click();
  await expect(card).toBeVisible();
  await page.screenshot({ path: info.outputPath('calendar-studio.png'), fullPage: true });
  expect(foreignRequests).toEqual([]); expect(errors).toEqual([]);
});
test('all-day boundaries and keyboard-only save work at this viewport', async ({ page }, info) => {
  await page.getByLabel('Event title').focus();
  await page.keyboard.type('Year-end break');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('All-day event')).toBeFocused();
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Start date', { exact: true })).toBeFocused();
  await page.getByLabel('Start date', { exact: true }).fill('2026-12-31');
  await page.getByLabel('Last day (included)').fill('2027-01-01');
  await page.getByLabel('Notes optional').focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Save event', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('article', { name: 'Year-end break' })).toContainText('2026-12-31 → 2027-01-01');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all' }).click();
  const dl = await downloading; const path = info.outputPath('all-day.ics'); await dl.saveAs(path);
  const data = await readFile(path, 'utf8');
  expect(data).toContain('DTEND;VALUE=DATE:20270102');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test('rejects impossible dates, DST gaps and end ordering without saving', async ({ page }) => {
  await page.getByRole('button', { name: 'Try an example' }).click();
  await page.getByLabel('Start date and time').fill('2026-03-08T02:30');
  await page.getByLabel('End date and time').fill('2026-03-08T04:00');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('does not exist');
  await expect(page.getByRole('article')).toHaveCount(0);
  await page.getByLabel('Start date and time').fill('2026-03-08T05:00');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('after the start');
});
test('repeated-hour endpoint choices survive multiple edits', async ({ page }) => {
  await page.getByRole('button', { name: 'Try an example' }).click();
  await page.getByLabel('Start date and time').fill('2026-11-01T01:30');
  await page.getByLabel('End date and time').fill('2026-11-01T01:15');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('occurs twice');
  await page.getByText('Daylight-saving time options', { exact: true }).click();
  await page.getByLabel('Start occurrence').selectOption('earlier');
  await page.getByLabel('End occurrence').selectOption('later');
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  for (let i = 0; i < 2; i++) { await page.getByRole('article').getByRole('button', { name: 'Edit', exact: true }).click(); await page.getByLabel('Event title').fill(`Repeated hour ${i}`); await page.getByRole('button', { name: 'Save changes' }).click(); }
  const event = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).events[0], storageKey);
  expect([event.start, event.end, event.sequence]).toEqual(['2026-11-01T05:30:00Z', '2026-11-01T06:15:00Z', 2]);
});
test('local parser is explicit and does not save without review', async ({ page }) => {
  await page.getByText('Start from structured text', { exact: false }).click();
  await page.getByLabel('Structured event text').fill('Meet tomorrow at lunch');
  await page.getByRole('button', { name: 'Fill editor' }).click();
  await expect(page.getByRole('status')).toContainText('Use Title');
  await page.getByLabel('Structured event text').fill('Offsite | 2026-12-31..2027-01-02 | all-day');
  await page.getByRole('button', { name: 'Fill editor' }).click();
  await expect(page.getByLabel('Event title')).toHaveValue('Offsite');
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByText(/External AI is not configured/)).toBeVisible();
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Offsite' })).toBeVisible();
});
test('unsupported imports cannot partially modify saved events', async ({ page }) => {
  await page.getByRole('button', { name: 'Try an example' }).click();
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Test//EN','BEGIN:VEVENT','UID:synthetic@example.test','DTSTAMP:20261009T120000Z','SUMMARY:Unsupported','DTSTART:20261012T090000Z','DTEND:20261012T100000Z','RRULE:FREQ=WEEKLY','END:VEVENT','END:VCALENDAR'].join('\r\n');
  await page.getByLabel('Import calendar file').setInputFiles({ name: 'unsupported.ics', mimeType: 'text/calendar', buffer: Buffer.from(ics) });
  await expect(page.getByRole('status')).toContainText('does not support RRULE');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'Review import' })).toHaveCount(0);
});
test('corrupt persistence and synthetic legacy keys cannot crash boot', async ({ page }) => {
  await page.evaluate(key => { localStorage.setItem(key, '{corrupt'); localStorage.setItem('app_settings', '{synthetic-invalid'); }, storageKey);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Good plans deserve/ })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Existing data is untouched');
  await page.getByRole('button', { name: 'Try an example' }).click();
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), storageKey)).toBe('{corrupt');
  await expect(page.getByRole('article')).toHaveCount(1);
});
test('blocked persistence reports a backup requirement instead of losing the in-tab event', async ({ page }) => {
  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new DOMException('Synthetic quota failure', 'QuotaExceededError'); }; });
  await page.getByRole('button', { name: 'Try an example' }).click();
  await page.getByRole('button', { name: 'Save event', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('not saved');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Export all' })).toBeEnabled();
});

test('has no serious accessibility violations in empty and saved states', async ({ page }) => {
  for (const saved of [false, true]) {
    if (saved) { await page.getByRole('button', { name: 'Try an example' }).click(); await page.getByRole('button', { name: 'Save event', exact: true }).click(); }
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
  }
});
