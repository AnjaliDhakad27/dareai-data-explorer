import { ParamMap } from '@angular/router';
import { ORDER_SORT_FIELDS, ORDER_STATUSES, QueryState } from './order.model';

export function queryStateFromParams(params: Pick<ParamMap, 'get'>): QueryState {
  const requestedSort = params.get('sort') ?? '';
  const requestedStatus = params.get('status') ?? '';
  const page = Number(params.get('page'));
  return {
    q: params.get('q') ?? '',
    status: ORDER_STATUSES.find(status => status === requestedStatus) ?? '',
    sort: ORDER_SORT_FIELDS.find(sort => sort === requestedSort) ?? 'date',
    direction: params.get('direction') === 'asc' ? 'asc' : 'desc',
    page: Number.isSafeInteger(page) && page > 0 ? page : 1
  };
}
