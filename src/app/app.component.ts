import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { AfterViewChecked, Component, DestroyRef, ElementRef, HostListener, inject, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, distinctUntilChanged, EMPTY, finalize, map, merge, of, startWith, switchMap, takeUntil, tap, Subject } from 'rxjs';
import { OrderApiService } from './order-api.service';
import { ORDER_SORT_FIELDS, ORDER_STATUSES, Order, OrderSortField, OrderStatus, PAGE_SIZE, QueryState } from './order.model';
import { queryStateFromParams } from './query-state';
import { debouncedSearchQueries } from './search-query';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ScrollingModule, CurrencyPipe, DatePipe],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit, AfterViewChecked {
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
  private cancelSearch$ = new Subject<void>();
  private detailReload$ = new Subject<string>();
  private returnFocusTo: HTMLElement | null = null;
  private returnScrollOffset: number | null = null;
  private drawerHasFocus = false;
  @ViewChild('detailDrawer') private detailDrawer?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild(CdkVirtualScrollViewport) private ordersViewport?: CdkVirtualScrollViewport;
  readonly pageSize = PAGE_SIZE;
  readonly statuses = ORDER_STATUSES;
  rowHeight = window.innerHeight <= 700 ? 24 : 40;

  @HostListener('window:resize')
  onViewportResize(): void {
    this.rowHeight = window.innerHeight <= 700 ? 24 : 40;
  }

  ngOnInit(): void {
    const params = this.route.queryParamMap;
    params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(p => {
      this.cancelSearch$.next();
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
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();

    debouncedSearchQueries(
      this.searchControl.valueChanges.pipe(startWith(this.searchControl.value)),
      this.cancelSearch$
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(q => {
      if (q !== this.state.q) this.updateQuery({ q, page: 1 });
    });

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
        this.rows = [];
        this.total = 0;
        return this.api.list(s).pipe(
          takeUntil(this.cancelRequests$),
          catchError((error: HttpErrorResponse) => {
            const apiMessage = typeof error.error?.message === 'string' ? error.error.message : '';
            this.error = error.status === 0
              ? 'The API is unreachable. Check the service and retry.'
              : error.status === 503
                ? `${apiMessage || 'The mock API temporarily failed.'} This is a simulated failure; previous results were cleared. Please retry.`
                : `The server returned an error (${error.status}). Previous results were cleared.`;
            return EMPTY;
          }),
          finalize(() => { this.loading = false; })
        );
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(response => {
      const lastPage = Math.max(1, Math.ceil(response.total / this.pageSize));
      if (this.state.page > lastPage) {
        this.updateQuery({ page: lastPage });
        return;
      }
      this.rows = response.data;
      this.total = response.total;
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
      switchMap(id => {
        if (!id) return of(null);
        return this.api.getById(id).pipe(catchError(() => {
          this.detailLoading = false;
          this.detailError = 'Order details could not be loaded. The order list is still available.';
          return EMPTY;
        }));
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(order => {
      this.selected = order;
      this.detailLoading = false;
    });
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
    if (!this.detailId && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.searchInput?.nativeElement.focus();
      return;
    }
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
      q: this.state.q || null,
      status: this.state.status || null,
      sort: this.state.sort,
      direction: this.state.direction,
      page: this.state.page === 1 ? null : this.state.page
    };
    this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }

  setStatus(status: string): void {
    const validStatus = ORDER_STATUSES.find(value => value === status) ?? '';
    this.updateQuery({ q: this.searchControl.value, status: validStatus, page: 1 });
  }

  setSort(sort: string): void {
    const validSort = ORDER_SORT_FIELDS.find(value => value === sort);
    if (!validSort) return;
    this.updateQuery({ q: this.searchControl.value, sort: validSort, page: 1 });
  }

  toggleDirection(): void {
    this.updateQuery({
      q: this.searchControl.value,
      direction: this.state.direction === 'asc' ? 'desc' : 'asc',
      page: 1
    });
  }

  setPage(page: number): void {
    if (!Number.isSafeInteger(page) || page < 1 || page > this.pageCount) return;
    this.updateQuery({ q: this.searchControl.value, page });
  }

  reset(): void {
    this.searchControl.setValue('');
    this.updateQuery({ q: '', status: '', sort: 'date', direction: 'desc', page: 1 });
  }

  retry(): void { this.reload$.next(); }

  openOrder(order: Order, target: EventTarget | null): void {
    this.returnFocusTo = target instanceof HTMLElement ? target : null;
    this.returnScrollOffset = this.ordersViewport?.elementRef.nativeElement.scrollTop
      ?? 0;
    this.router.navigate([], { relativeTo: this.route, queryParams: { orderId: order.id }, queryParamsHandling: 'merge' });
  }

  closeDetails(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { orderId: null }, queryParamsHandling: 'merge' });
  }

  retryDetail(): void {
    if (this.detailId) this.detailReload$.next(this.detailId);
  }

  statusClass(status: OrderStatus): string { return `status-${status.toLowerCase()}`; }

  sortAria(field: OrderSortField): 'ascending' | 'descending' | 'none' {
    if (this.state.sort !== field) return 'none';
    return this.state.direction === 'asc' ? 'ascending' : 'descending';
  }

  trackOrder(_index: number, order: Order): string { return order.id; }

  get pageCount(): number { return Math.max(1, Math.ceil(this.total / this.pageSize)); }
  get startIndex(): number { return this.total ? (this.state.page - 1) * this.pageSize + 1 : 0; }
  get endIndex(): number { return Math.min(this.state.page * this.pageSize, this.total); }
}
