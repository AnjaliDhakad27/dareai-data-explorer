import { asyncScheduler, map, Observable, SchedulerLike, switchMap, takeUntil, timer } from 'rxjs';

/** Debounce text input and discard a pending value when URL navigation wins the race. */
export function debouncedSearchQueries(
  values: Observable<string>,
  navigation: Observable<unknown>,
  delayMs = 300,
  scheduler: SchedulerLike = asyncScheduler
): Observable<string> {
  return values.pipe(
    switchMap(value => timer(delayMs, scheduler).pipe(
      takeUntil(navigation),
      map(() => value)
    ))
  );
}
