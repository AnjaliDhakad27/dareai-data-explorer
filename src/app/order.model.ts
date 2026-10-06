export interface Order {
  id: string;
  customer: string;
  email: string;
  status: 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
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
  status: string;
  sort: string;
  direction: 'asc' | 'desc';
  page: number;
}

export const PAGE_SIZE = 1000;
