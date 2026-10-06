import { describe, expect, it } from 'vitest';
import { Subject, switchMap } from 'rxjs';
import { queryStateFromParams } from '../src/app/query-state';

describe('explorer request and URL state', () => {
  it('restores every list control from shared query parameters', () => {
    const values: Record<string, string> = { q: 'maya', status: 'Shipped', sort: 'total', direction: 'asc', page: '4' };
    expect(queryStateFromParams({ get: key => values[key] ?? null })).toEqual({
      q: 'maya', status: 'Shipped', sort: 'total', direction: 'asc', page: 4
    });
  });

  it('falls back to safe defaults for invalid sort and page values', () => {
    expect(queryStateFromParams({ get: key => ({ sort: 'DROP TABLE', page: '-2' }[key] ?? null) })).toEqual({
      q: '', status: '', sort: 'date', direction: 'desc', page: 1
    });
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
});
