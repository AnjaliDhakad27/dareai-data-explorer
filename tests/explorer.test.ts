import { describe, expect, it } from 'vitest';
import { Subject, switchMap } from 'rxjs';
import { TestScheduler } from 'rxjs/testing';
import { createServer } from 'node:http';
import { createApp, orders } from '../mock-api/server';
import { queryStateFromParams } from '../src/app/query-state';
import { debouncedSearchQueries } from '../src/app/search-query';

describe('explorer request and URL state', () => {
  it('restores every list control from shared query parameters', () => {
    const values: Record<string, string> = { q: 'maya', status: 'Shipped', sort: 'total', direction: 'asc', page: '4' };
    expect(queryStateFromParams({ get: key => values[key] ?? null })).toEqual({
      q: 'maya', status: 'Shipped', sort: 'total', direction: 'asc', page: 4
    });
  });

  it('falls back to safe defaults for invalid sort and page values', () => {
    expect(queryStateFromParams({ get: key => ({ sort: 'DROP TABLE', status: 'Unknown', page: '-2' }[key] ?? null) })).toEqual({
      q: '', status: '', sort: 'date', direction: 'desc', page: 1
    });
  });

  it('cancels pending debounced search when URL navigation restores the same query', () => {
    const scheduler = new TestScheduler(() => undefined);
    const searches = new Subject<string>();
    const navigation = new Subject<void>();
    const results: string[] = [];
    debouncedSearchQueries(searches, navigation, 300, scheduler).subscribe(value => results.push(value));

    scheduler.schedule(() => searches.next('maya'), 0);
    scheduler.schedule(() => navigation.next(), 100);
    scheduler.schedule(() => searches.next('maya'), 150);
    scheduler.schedule(() => expect(results).toEqual(['maya']), 451);
    scheduler.flush();
  });

  it('ignores a slow superseded response and only emits the newest result', () => {
    const requests = new Subject<string>();
    const first = new Subject<string>();
    const second = new Subject<string>();
    const results: string[] = [];
    requests.pipe(switchMap(key => key === 'first' ? first : second)).subscribe(value => results.push(value));

    requests.next('first');
    requests.next('second');
    first.next('stale result');
    second.next('current result');

    expect(results).toEqual(['current result']);
  });

  it('serves server-side search, filter, sort and pagination over 12,000 records', async () => {
    expect(orders).toHaveLength(12_000);
    const server = createServer(createApp({ simulateFailures: false }));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port');

    try {
      const base = `http://127.0.0.1:${address.port}`;
      const response = await fetch(`${base}/api/orders?q=ananya&status=Shipped&sort=total&direction=asc&page=1&pageSize=2`);
      expect(response.status).toBe(200);
      const result = await response.json() as { data: { customer: string; status: string; total: number }[]; total: number; page: number; pageSize: number };
      expect(result.total).toBeGreaterThanOrEqual(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(2);
      expect(result.data).toHaveLength(2);
      expect(result.data.every(order => order.customer.toLowerCase().includes('ananya') && order.status === 'Shipped')).toBe(true);
      expect(result.data[0].total).toBeLessThanOrEqual(result.data[1].total);

      const secondPageResponse = await fetch(`${base}/api/orders?q=ananya&status=Shipped&sort=total&direction=asc&page=2&pageSize=2`);
      const secondPage = await secondPageResponse.json() as typeof result;
      expect(secondPage.page).toBe(2);
      expect(secondPage.data[0].id).not.toBe(result.data[0].id);

      const missingOrder = await fetch(`${base}/api/orders/ORD-missing`);
      expect(missingOrder.status).toBe(404);

      const missingAsset = await fetch(`${base}/missing-asset.js`);
      expect(missingAsset.status).toBe(404);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it('returns a stable health check without the mock API delay or random failure', async () => {
    const server = createServer(createApp({ random: () => 0 }));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port');

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/health`);
      expect(response.status).toBe(200);
      expect(response.headers.has('x-powered-by')).toBe(false);
      expect(await response.json()).toEqual({ status: 'ok' });
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it('can deterministically exercise the mock API failure path', async () => {
    const randomValues = [0, 0];
    const server = createServer(createApp({ random: () => randomValues.shift() ?? 0 }));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind a TCP port');

    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/api/orders?pageSize=1`);
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ message: 'Random mock failure. Please retry.' });
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
});
