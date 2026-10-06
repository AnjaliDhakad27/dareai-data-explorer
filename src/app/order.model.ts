export const ORDER_STATUSES = ['Processing', 'Shipped', 'Delivered', 'Cancelled'] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];

export const ORDER_SORT_FIELDS = ['date', 'total', 'customer', 'status'] as const;
export type OrderSortField = typeof ORDER_SORT_FIELDS[number];

export interface Order {
  id: string;
  customer: string;
  email: string;
  status: OrderStatus;
  total: number;
  date: string;
  items: number;
}
export interface OrderResponse {
  data: Order[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QueryState {
  q: string;
  status: OrderStatus | '';
  sort: OrderSortField;
  direction: 'asc' | 'desc';
  page: number;
}

export const PAGE_SIZE = 1000;
