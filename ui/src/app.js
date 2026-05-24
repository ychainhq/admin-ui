import { createRouter } from './router.js';
import { api } from './api.js';
import { TenantListView } from './views/TenantListView.js';
import { TenantConfigView } from './views/TenantConfigView.js';
import { TenantCreateView } from './views/TenantCreateView.js';
import { NodeListView } from './views/NodeListView.js';
import { NodeDetailView } from './views/NodeDetailView.js';
import { CustomerListView } from './views/CustomerListView.js';
import { CustomerCreateView } from './views/CustomerCreateView.js';
import { CustomerProfileView } from './views/CustomerProfileView.js';
import { CustomerComplianceView } from './views/CustomerComplianceView.js';
import { CustomerGovernanceView } from './views/CustomerGovernanceView.js';
import { CustomerBalancesView } from './views/CustomerBalancesView.js';
import { CustomerDepositsView } from './views/CustomerDepositsView.js';
import { CustomerWithdrawalsView } from './views/CustomerWithdrawalsView.js';
import { WithdrawalBatchesView } from './views/WithdrawalBatchesView.js';
import { WalletsView } from './views/WalletsView.js';
import { SigningTasksView } from './views/SigningTasksView.js';
import { ExternalSignersView } from './views/ExternalSignersView.js';

const router = createRouter();
const deps = { api, router };
const appEl = () => document.getElementById('app');

router
  .on('/', () => { router.navigate('#/tenants'); return null; })
  .on('/dashboard', () => { router.navigate('#/tenants'); return null; })
  .on('/activity', () => { router.navigate('#/tenants'); return null; })
  .on('/tenants', (params) => TenantListView.mount(appEl(), params, deps))
  .on('/tenants/new', (params) => TenantCreateView.mount(appEl(), params, deps))
  .on('/tenants/:id/config', (params) => TenantConfigView.mount(appEl(), params, deps))
  // Customers — /new and sub-routes before /:id to avoid route collisions
  .on('/customers', (params) => CustomerListView.mount(appEl(), params, deps))
  .on('/customers/new', (params) => CustomerCreateView.mount(appEl(), params, deps))
  .on('/customers/:id/profile',    (params) => CustomerProfileView.mount(appEl(), params, deps))
  .on('/customers/:id/compliance', (params) => CustomerComplianceView.mount(appEl(), params, deps))
  .on('/customers/:id/governance', (params) => CustomerGovernanceView.mount(appEl(), params, deps))
  .on('/customers/:id/balances',   (params) => CustomerBalancesView.mount(appEl(), params, deps))
  .on('/customers/:id/deposits',    (params) => CustomerDepositsView.mount(appEl(), params, deps))
  .on('/customers/:id/withdrawals', (params) => CustomerWithdrawalsView.mount(appEl(), params, deps))
  .on('/customers/:id', (params) => { router.navigate(`#/customers/${params.id}/profile`); return null; })
  // Operations
  .on('/withdrawal-batches', (params) => WithdrawalBatchesView.mount(appEl(), params, deps))
  .on('/wallets',            (params) => WalletsView.mount(appEl(), params, deps))
  .on('/signing-tasks',      (params) => SigningTasksView.mount(appEl(), params, deps))
  .on('/external-signers',   (params) => ExternalSignersView.mount(appEl(), params, deps))
  .on('/nodes', (params) => NodeListView.mount(appEl(), params, deps))
  .on('/nodes/:nodeId', (params) => NodeDetailView.mount(appEl(), params, deps));

router.start();
