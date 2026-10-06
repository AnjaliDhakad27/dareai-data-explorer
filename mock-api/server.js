const express = require('express');
const path = require('node:path');
const PORT = process.env.PORT || 3001;
const statuses = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];
const first = ['Aarav','Ananya','Ishaan','Meera','Rohan','Diya','Kabir','Sana','Arjun','Tara','Vivaan','Aditi','Reyansh','Kiara','Dev','Maya'];
const last = ['Sharma','Patel','Singh','Gupta','Verma','Reddy','Khan','Mehta','Iyer','Joshi','Das','Kapoor'];
const orders = Array.from({ length: 12000 }, (_, i) => {
  const customer = `${first[i % first.length]} ${last[(i * 7) % last.length]}`;
  const date = new Date(Date.UTC(2024, 0, 1) + (i * 7919 % 900) * 86400000);
  return {
    id: `ORD-${String(100000 + i)}`, customer,
    email: `${customer.toLowerCase().replaceAll(' ', '.')}@example.com`,
    status: statuses[i % statuses.length], total: Math.round((18 + ((i * 137) % 250000) / 100) * 100) / 100,
    date: date.toISOString(), items: (i % 7) + 1
  };
});
function createApp({ simulateFailures = true, random = Math.random } = {}) {
  const app = express();
  app.disable('x-powered-by');

  // The deployment health check must stay reliable. Simulated latency/failures
  // apply only to data API requests, never to the app shell or its assets.
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api', (req, res, next) => {
    if (!simulateFailures) return next();
    const delay = 200 + Math.floor(random() * 2801);
    setTimeout(() => {
      if (random() < 0.1) return res.status(503).json({ message: 'Random mock failure. Please retry.' });
      next();
    }, delay);
  });
  app.get('/api/orders', (req, res) => {
    const q = String(req.query.q || '').toLowerCase().trim();
    const status = String(req.query.status || '');
    const sort = ['date', 'total', 'customer', 'status'].includes(req.query.sort) ? req.query.sort : 'date';
    const direction = req.query.direction === 'asc' ? 1 : -1;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(1000, Math.max(1, Number.parseInt(req.query.pageSize, 10) || 1000));
    const result = orders.filter(o => (!status || o.status === status) &&
      (!q || `${o.id} ${o.customer} ${o.email}`.toLowerCase().includes(q)));
    result.sort((a, b) => {
      const av = a[sort], bv = b[sort];
      return (typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))) * direction;
    });
    res.json({ data: result.slice((page - 1) * pageSize, page * pageSize), total: result.length, page, pageSize });
  });
  app.get('/api/orders/:id', (req, res) => {
    const order = orders.find(o => o.id === req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  });

  // In production, serve Angular from the same origin as the API.
  // Local development continues to use `ng serve` and its /api proxy.
  const angularBrowserBuild = path.join(__dirname, '..', 'dist', 'dareai-data-explorer', 'browser');
  app.use(express.static(angularBrowserBuild));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path === '/api' || req.path.startsWith('/api/') || path.extname(req.path)) return next();
    res.sendFile(path.join(angularBrowserBuild, 'index.html'), error => {
      if (error) next(error);
    });
  });

  return app;
}

if (require.main === module) {
  createApp().listen(PORT, () => console.log(`Mock API ready at http://localhost:${PORT} with ${orders.length} orders`));
}

module.exports = { createApp, orders };
