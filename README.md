# DareAISearch Order Explorer

An Angular and TypeScript implementation of **Problem Statement 1** from the DareAISearch Front-End Developer assignment. The explorer searches and filters 12,000 mock orders through a local Express API designed to simulate real network delays and failures.

## Run locally

Requires Node.js 20.19+, 22.12+, or 24+. Node 22 LTS is recommended. Angular 20 does not support Node 21.

```bash
npm install
npm run api
```

In a second terminal:

```bash
npm start
```

Open [http://localhost:4200](http://localhost:4200). Angular proxies `/api` requests to the mock server on port 3001 via `proxy.conf.json`.

Run the focused tests with `npm test` and create a production build with `npm run build`. Use a supported Node version: 20.19+, 22.12+, or 24+ (Node 22 LTS recommended).

## What it demonstrates

- 12,000 deterministic mock orders with server-side search, status filtering, sorting, and 1,000-row pagination. CDK virtual scrolling limits the rows mounted in the DOM.
- Random 200 ms–3 s latency and approximately 10% simulated API failures.
- Debounced search and RxJS `switchMap` cancellation so superseded requests cannot replace the latest result.
- Search, status, sort, direction, and page stored in URL query parameters. Browser history and shared URLs restore that state. The selected order is also deep-linkable through `orderId`.
- Explicit loading, empty, and error states. Failed list requests clear prior rows and offer a retry; a detail request can fail independently and be retried while the list remains available.
- Keyboard-activatable rows, labeled controls, visible focus, table semantics, live announcements, and a keyboard-managed detail dialog with focus restoration.
- Stable row tracking, server pagination, and CDK fixed-size virtual scrolling keep DOM work bounded across the 12,000-row dataset.

## Architecture and decisions

- **Angular standalone UI:** `app.component.ts` holds view behavior and `app.component.html` holds the template, keeping markup separate from component logic without adding unnecessary feature modules.
- **Express mock API:** `mock-api/server.js` generates the dataset and owns search, filter, sort, and pagination. No large dataset is shipped to or processed by the browser.
- **URL as list state:** `query-state.ts` parses URL parameters with typed, safe defaults. A pending text search is cancelled if browser navigation restores another URL state. `search-query.ts` owns the cancellable debounce behavior and its focused test.
- **Cancellation at the request boundary:** route query changes feed an RxJS `switchMap`; Angular `HttpClient` cancels/unsubscribes superseded requests. Typing immediately clears current results and cancels the active request, then waits 300 ms before updating the URL and requesting new results.
- **Honest failures:** the list error path clears rows and totals, and a retry starts a fresh request. The UI does not present older rows as current after a failed query.
- **Bounded rendering:** pagination returns 1,000 records at a time, while CDK virtual scrolling only renders the viewport and nearby rows. Page navigation remains available and its index is shareable in the URL.

## Tests

The Vitest suite covers query-string restoration and invalid values, stale-response cancellation, route changes cancelling pending search, server-side search/filter/sort/pagination over 12,000 orders, stable health checks, and the simulated API failure path. Before recording the demo, check keyboard navigation and screen-reader announcements manually, and trigger a simulated API failure with a retry.

## Free deployment (Render)

The repository includes a `render.yaml` Blueprint for a single free Node web service. It builds Angular and serves the frontend and `/api` from the same Express process. Its health check bypasses simulated API latency and failures. Push this project to a GitHub repository, then in Render choose **New + > Blueprint**, connect the repository, and deploy the detected `render.yaml` service. Render assigns a public `onrender.com` URL.

Render's free web service spins down after 15 minutes without requests, so the first visit after inactivity may take about a minute to start. This app's generated orders are held in memory and reset whenever the service restarts. These limits make the free service suitable for a portfolio/demo deployment, not persistent production data.

## Tradeoffs

- Generated orders live in memory and reset when the service restarts. This is intentionally a mock API, not persistent order storage.
- Render free instances sleep after 15 idle minutes and the first request after sleep may take about a minute.
- The detail drawer is deep-linkable and dismissible while retaining query parameters and restoring the invoking row focus and virtual scroll offset.

## Sources and references

- [Angular](https://angular.dev/)
- [Angular HttpClient](https://angular.dev/guide/http)
- [RxJS `switchMap`](https://rxjs.dev/api/operators/switchMap)
- [Express](https://expressjs.com/)
- [WAI-ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [Render free services](https://render.com/docs/free)

## AI usage disclosure

ChatGPT assisted with reviewing the assignment and editing the implementation and documentation. The applicant should review the code and include the share link or export for the relevant AI conversation when submitting, as required by the assignment.
