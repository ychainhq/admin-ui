import { createRouter } from './router.js';
import { api } from './api.js';
import { TenantListView } from './views/TenantListView.js';
import { TenantConfigView } from './views/TenantConfigView.js';
import { TenantCreateView } from './views/TenantCreateView.js';
import { NodeListView } from './views/NodeListView.js';
import { NodeDetailView } from './views/NodeDetailView.js';

const router = createRouter();
const deps = { api, router };
const appEl = () => document.getElementById('app');

router
  .on('/', () => { router.navigate('#/tenants'); return null; })
  .on('/dashboard', () => { router.navigate('#/tenants'); return null; })
  .on('/assets',   () => { router.navigate('#/tenants'); return null; })
  .on('/activity', () => { router.navigate('#/tenants'); return null; })
  .on('/tenants', (params) => TenantListView.mount(appEl(), params, deps))
  .on('/tenants/new', (params) => TenantCreateView.mount(appEl(), params, deps))
  .on('/tenants/:id/config', (params) => TenantConfigView.mount(appEl(), params, deps))
  .on('/nodes', (params) => NodeListView.mount(appEl(), params, deps))
  .on('/nodes/:nodeId', (params) => NodeDetailView.mount(appEl(), params, deps));

router.start();
