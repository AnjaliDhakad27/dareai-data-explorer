import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { AfterViewChecked, Component, DestroyRef, ElementRef, HostListener, inject, ViewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, EMPTY, finalize, map, merge, of, startWith, switchMap, takeUntil, tap, Subject } from 'rxjs';
import { OrderApiService } from './order-api.service';
import { Order, PAGE_SIZE, QueryState } from './order.model';
import { queryStateFromParams } from './query-state';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ScrollingModule, CurrencyPipe, DatePipe],
  template: `
  <main class="shell">
    <div class="app-content" [attr.inert]="detailId ? '' : null" [attr.aria-hidden]="detailId ? 'true' : null">
    <header class="topbar">
      <div class="brand-mark">D</div>
      <div><div class="brand">DareAISearch</div><div class="subbrand">FRONTEND ENGINEERING ASSIGNMENT</div></div>
      <span class="api-pill"><span class="pulse"></span> Mock API</span>
    </header>

    <section class="intro">
      <div>
        <p class="eyebrow">OPERATIONS / ORDERS</p>
        <h1>Order explorer</h1>
        <p class="lede">Search, inspect and manage a large order dataset without losing your place.</p>
      </div>
      <div class="metric"><span class="metric-label">DATASET</span><strong>10,000+</strong><span>mock records</span></div>
    </section>

    <section class="panel">
      <div class="toolbar">
        <label class="search-wrap">
          <span class="sr-only">Search orders by order ID, customer, or email</span>
          <span class="search-icon" aria-hidden="true">⌕</span>
          <input [formControl]="searchControl" placeholder="Search order, customer or email…" autocomplete="off" aria-label="Search orders">
          <kbd>⌘ K</kbd>
        </label>
        <label class="filter-label">STATUS
          <select [value]="state.status" (change)="setStatus($any($event.target).value)" aria-label="Filter by status">
            <option value="">All statuses</option><option>Processing</option><option>Shipped</option><option>Delivered</option><option>Cancelled</option>
          </select>
        </label>
        <button class="ghost-btn" (click)="reset()">Reset</button>
      </div>

      <div class="table-meta" aria-live="polite" aria-atomic="true">
        <div><strong>{{ total | number }}</strong> results <span class="muted">· Page {{ state.page }} of {{ pageCount }}</span></div>
        <label class="sort-label">SORT BY
          <select [value]="state.sort" (change)="setSort($any($event.target).value)" aria-label="Sort orders by">
            <option value="date">Order date</option><option value="total">Order total</option><option value="customer">Customer</option><option value="status">Status</option>
          </select>
          <button class="sort-dir" [attr.aria-label]="'Sort direction: ' + state.direction" (click)="toggleDirection()">{{ state.direction === 'asc' ? '↑' : '↓' }}</button>
        </label>
      </div>

      <div *ngIf="loading" class="loading" role="status"><span class="spinner"></span> Fetching the latest orders…</div>
      <div *ngIf="error && !loading" class="error-state" role="alert">
        <div class="error-icon">!</div><div><strong>We couldn't load these orders.</strong><p>{{ error }}</p><button class="primary-btn" (click)="retry()">Try again</button></div>
      </div>
      <div *ngIf="!loading && !error && rows.length === 0" class="empty-state"><span>⌕</span><strong>No matching orders</strong><p>Try changing your search or filters.</p><button class="ghost-btn" (click)="reset()">Clear filters</button></div>

      <div class="table-scroll" *ngIf="!loading && !error && rows.length">
        <cdk-virtual-scroll-viewport class="orders-viewport" [itemSize]="rowHeight" minBufferPx="480" maxBufferPx="960" tabindex="0" role="region" aria-label="Virtualized order results. Use the arrow keys or Page Up and Page Down to scroll.">
        <table [attr.aria-rowcount]="total + 1">
          <caption class="sr-only">Orders matching the current search and filters</caption>
          <thead><tr><th scope="col">ORDER ID</th><th scope="col">CUSTOMER</th><th scope="col">STATUS</th><th scope="col"><button class="th-button" (click)="setSort('total')">TOTAL ↕</button></th><th scope="col"><button class="th-button" (click)="setSort('date')">ORDER DATE ↕</button></th><th scope="col">ITEMS</th><th scope="col"><span class="sr-only">Open details</span></th></tr></thead>
          <tbody>
            <tr *cdkVirtualFor="let order of rows; let index = index; trackBy: trackOrder" tabindex="0" [attr.aria-rowindex]="(state.page - 1) * pageSize + index + 2" [attr.aria-label]="'Open order ' + order.id + ' for ' + order.customer" (click)="openOrder(order, $event.currentTarget)" (keydown.enter)="openOrder(order, $event.currentTarget)" (keydown.space)="openOrder(order, $event.currentTarget); $event.preventDefault()">
              <td class="order-id">{{ order.id }}</td>
              <td><div class="customer">{{ order.customer }}</div><div class="email">{{ order.email }}</div></td>
              <td><span class="status" [class]="statusClass(order.status)"><span class="status-dot"></span>{{ order.status }}</span></td>
              <td class="money">{{ order.total | currency:'USD':'symbol':'1.2-2' }}</td>
              <td>{{ order.date | date:'MMM d, y' }}</td><td>{{ order.items }}</td><td class="chevron">↗</td>
            </tr>
          </tbody>
        </table>
        </cdk-virtual-scroll-viewport>
      </div>

      <footer class="pagination" *ngIf="!loading && !error && rows.length">
        <span class="muted">Showing {{ startIndex }}–{{ endIndex }} of {{ total | number }}</span>
        <div class="page-controls"><button class="page-btn" [disabled]="state.page <= 1" (click)="setPage(state.page - 1)" aria-label="Previous page">←</button><span>Page <strong>{{ state.page }}</strong> / {{ pageCount }}</span><button class="page-btn" [disabled]="state.page >= pageCount" (click)="setPage(state.page + 1)" aria-label="Next page">→</button></div>
      </footer>
    </section>
    <p class="footnote">Built for resilience <span>·</span> URL-synced state <span>·</span> cancellable requests <span>·</span> accessible interactions</p>
    </div>

    <div class="backdrop" *ngIf="detailId" (click)="closeDetails()" aria-hidden="true"></div>
    <aside #detailDrawer class="detail-drawer" *ngIf="detailId" role="dialog" aria-modal="true" aria-labelledby="detail-title" tabindex="-1">
      <div class="drawer-head"><div><p class="eyebrow">ORDER DETAILS</p><h2 id="detail-title">{{ selected?.id || detailId }}</h2></div><button class="close-btn" aria-label="Close order details" (click)="closeDetails()">×</button></div>
      <div *ngIf="detailLoading" class="detail-message" role="status"><span class="spinner"></span> Loading order details…</div>
      <div *ngIf="detailError && !detailLoading" class="detail-message detail-error" role="alert"><p>{{ detailError }}</p><button class="primary-btn" (click)="retryDetail()">Try again</button></div>
      <ng-container *ngIf="selected">
        <span class="status" [class]="statusClass(selected.status)"><span class="status-dot"></span>{{ selected.status }}</span>
        <div class="detail-total"><span>Order total</span><strong>{{ selected.total | currency:'USD' }}</strong></div>
        <div class="detail-list"><div><span>Customer</span><strong>{{ selected.customer }}</strong></div><div><span>Email</span><strong>{{ selected.email }}</strong></div><div><span>Order date</span><strong>{{ selected.date | date:'longDate' }}</strong></div><div><span>Items</span><strong>{{ selected.items }}</strong></div></div>
        <p class="drawer-note">This detail view is deep-linkable. Closing it returns to your previous list state.</p>
      </ng-container>
      <button class="primary-btn full-btn" (click)="closeDetails()">Back to orders</button>
    </aside>
    <div class="sr-only" aria-live="polite" aria-atomic="true">{{ announcement }}</div>
  </main>`
})
export class AppComponent implements AfterViewChecked {
  private api = inject(OrderApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  searchControl = new FormControl('', { nonNullable: true });
  rows: Order[] = [];
  total = 0;
  loading = false;
  error = '';
  selected: Order | null = null;
  detailId = '';
  detailLoading = false;
  detailError = '';
  announcement = '';
  state: QueryState = { q: '', status: '', sort: 'date', direction: 'desc', page: 1 };
  private reload$ = new Subject<void>();
  private cancelRequests$ = new Subject<void>();
  private detailReload$ = new Subject<string>();
  private returnFocusTo: HTMLElement | null = null;
  private returnScrollOffset: number | null = null;
  private drawerHasFocus = false;
  @ViewChild('detailDrawer') private detailDrawer?: ElementRef<HTMLElement>;
  @ViewChild(CdkVirtualScrollViewport) private ordersViewport?: CdkVirtualScrollViewport;
  readonly pageSize = PAGE_SIZE;
  rowHeight = window.innerHeight <= 700 ? 24 : 40;

  @HostListener('window:resize')
  onViewportResize(): void {
    this.rowHeight = window.innerHeight <= 700 ? 24 : 40;
  }

  constructor() {
    const params = this.route.queryParamMap;
    params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(p => {
      this.state = queryStateFromParams(p);
      if (this.searchControl.value !== this.state.q) this.searchControl.setValue(this.state.q, { emitEvent: false });
    });

    this.searchControl.valueChanges.pipe(
      tap(() => {
        this.cancelRequests$.next();
        this.rows = [];
        this.total = 0;
        this.error = '';
        this.loading = true;
      }),
      startWith(this.searchControl.value), debounceTime(300), distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(q => this.updateQuery({ q, page: 1 }));

    merge(
      this.route.queryParamMap.pipe(
        map(() => this.state),
        distinctUntilChanged((previous, current) =>
          previous.q === current.q &&
          previous.status === current.status &&
          previous.sort === current.sort &&
          previous.direction === current.direction &&
          previous.page === current.page
        )
      ),
      this.reload$.pipe(map(() => this.state))
    ).pipe(
      switchMap(s => {
        this.loading = true;
        this.error = '';
        return this.api.list(s).pipe(
        takeUntil(this.cancelRequests$),
        catchError((e: HttpErrorResponse) => {
          this.rows = []; this.total = 0;
          const apiMessage = typeof e.error?.message === 'string' ? e.error.message : '';
          this.error = e.status === 0
            ? 'The API is unreachable. Check that the mock API is running and retry.'
            : e.status === 503
              ? `${apiMessage || 'The mock API temporarily failed.'} This is a simulated failure; your previous results were cleared. Please retry.`
              : `The server returned an error (${e.status}). Your previous results have been cleared.`;
          this.announcement = this.error;
          return EMPTY;
        }),
        finalize(() => { this.loading = false; })
      );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(response => {
      this.rows = response.data; this.total = response.total;
      this.announcement = `${response.total} orders found. Page ${response.page}.`;
    });

    merge(
      this.route.queryParamMap.pipe(map(p => p.get('orderId')), distinctUntilChanged()),
      this.detailReload$
    ).pipe(
      tap(id => {
        if (id && !this.detailId && !this.returnFocusTo) this.returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this.detailId = id ?? '';
        this.selected = null;
        this.detailError = '';
        this.detailLoading = Boolean(id);
        if (!id) this.drawerHasFocus = false;
      }),
      switchMap(id => id ? this.api.getById(id).pipe(catchError(() => {
        this.detailLoading = false;
        this.detailError = 'Order details could not be loaded. The order list is still available.';
        this.announcement = this.detailError;
        return EMPTY;
      })) : of(null)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(order => { this.selected = order; this.detailLoading = false; });
  }

  ngAfterViewChecked(): void {
    if (this.detailId && !this.drawerHasFocus && this.detailDrawer) {
      this.detailDrawer.nativeElement.focus();
      this.drawerHasFocus = true;
    } else if (!this.detailId && this.returnFocusTo) {
      const element = this.returnFocusTo;
      const scrollOffset = this.returnScrollOffset;
      this.returnFocusTo = null;
      this.returnScrollOffset = null;
      requestAnimationFrame(() => {
        element.focus({ preventScroll: true });
        if (scrollOffset !== null) {
          const viewport = this.ordersViewport?.elementRef.nativeElement ?? document.querySelector<HTMLElement>('.orders-viewport');
          if (viewport) viewport.scrollTop = scrollOffset;
        }
      });
    }
  }

  @HostListener('document:keydown', ['$event'])
  keepKeyboardFocusInDrawer(event: KeyboardEvent): void {
    if (!this.detailId) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeDetails();
      return;
    }
    if (event.key !== 'Tab' || !this.detailDrawer) return;
    const focusable = Array.from(this.detailDrawer.nativeElement.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === this.detailDrawer.nativeElement)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private updateQuery(patch: Partial<QueryState>): void {
    this.state = { ...this.state, ...patch };
    const queryParams: Record<string, string | number | null> = {
      q: this.state.q || null, status: this.state.status || null, sort: this.state.sort,
      direction: this.state.direction, page: this.state.page === 1 ? null : this.state.page
    };
    this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }
  setStatus(status: string): void { this.updateQuery({ q: this.searchControl.value, status, page: 1 }); }
  setSort(sort: string): void {
    if (!['date', 'total', 'customer', 'status'].includes(sort)) return;
    this.updateQuery({ q: this.searchControl.value, sort, page: 1 });
  }
  toggleDirection(): void { this.updateQuery({ q: this.searchControl.value, direction: this.state.direction === 'asc' ? 'desc' : 'asc', page: 1 }); }
  setPage(page: number): void { this.updateQuery({ q: this.searchControl.value, page }); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  reset(): void { this.searchControl.setValue(''); this.updateQuery({ q: '', status: '', sort: 'date', direction: 'desc', page: 1 }); }
  retry(): void { this.reload$.next(); }
  openOrder(order: Order, target: EventTarget | null): void {
    this.returnFocusTo = target instanceof HTMLElement ? target : null;
    this.returnScrollOffset = this.ordersViewport?.elementRef.nativeElement.scrollTop
      ?? document.querySelector<HTMLElement>('.orders-viewport')?.scrollTop
      ?? 0;
    this.router.navigate([], { relativeTo: this.route, queryParams: { orderId: order.id }, queryParamsHandling: 'merge' });
  }
  closeDetails(): void { this.router.navigate([], { relativeTo: this.route, queryParams: { orderId: null }, queryParamsHandling: 'merge' }); }
  retryDetail(): void { if (this.detailId) this.detailReload$.next(this.detailId); }
  statusClass(status: string): string { return `status status-${status.toLowerCase()}`; }
  trackOrder(_index: number, order: Order): string { return order.id; }
  get pageCount(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }
  get startIndex(): number { return this.total ? (this.state.page - 1) * this.pageSize + 1 : 0; }
  get endIndex(): number { return Math.min(this.state.page * this.pageSize, this.total); }
}
