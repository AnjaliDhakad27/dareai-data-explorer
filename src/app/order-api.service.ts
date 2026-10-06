import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Order, OrderResponse, PAGE_SIZE, QueryState } from './order.model';

@Injectable({ providedIn: 'root' })
export class OrderApiService {
  private http = inject(HttpClient);

  list(query: QueryState): Observable<OrderResponse> {
    let params = new HttpParams()
      .set('q', query.q)
      .set('status', query.status)
      .set('sort', query.sort)
      .set('direction', query.direction)
      .set('page', String(query.page))
      .set('pageSize', String(PAGE_SIZE));
    return this.http.get<OrderResponse>('/api/orders', { params });
  }

  getById(id: string): Observable<Order> {
    return this.http.get<Order>(`/api/orders/${encodeURIComponent(id)}`);
  }
}
