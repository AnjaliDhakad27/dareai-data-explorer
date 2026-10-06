import { ParamMap } from '@angular/router';
import { QueryState } from './order.model';

const SORTS = ['date', 'total', 'customer', 'status'] as const;

export function queryStateFromParams(params: Pick<ParamMap, 'get'>): QueryState {
  const requestedSort = params.get('sort') ?? '';
  const page = Number(params.get('page'));
  return {
    q: params.get('q') ?? '',
    status: params.get('status') ?? '',
    sort: SORTS.includes(requestedSort as typeof SORTS[number]) ? requestedSort : 'date',
    direction: params.get('direction') === 'asc' ? 'asc' : 'desc',
    page: Number.isSafeInteger(page) && page > 0 ? page : 1
  };
}
