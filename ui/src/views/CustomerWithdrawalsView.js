import rivets from '../rivets.js';
import { template as topBarTpl, createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl, createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl, createSidebarController } from '../components/DesktopSidebar.js';
import { template as mobileDrawerTpl, createMobileDrawerController } from '../components/MobileDrawer.js';
import { desktopTopBarHtml } from '../components/DesktopTopBar.js';
import { createActiveTenantController } from '../components/ActiveTenantBadge.js';
import { template as headerTpl, createCustomerDetailHeaderController } from '../components/CustomerDetailHeader.js';
import { getActiveTenantKey } from '../api.js';

const ROUTE = '/customers';
const ACTIVE_TAB = 'withdrawals';

async function safeLoad(fn) {
  try { return await fn(); }
  catch (e) {
    if (e.message?.startsWith('HTTP 404') || e.message?.toLowerCase().includes('not found')) return null;
    throw e;
  }
}

const desktopTopBarTpl = desktopTopBarHtml({
  breadcrumbHtml: `
    <span class="text-on-surface-variant">Platform</span>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <a rv-on-click="goToCustomers" href="#" class="text-on-surface-variant hover:text-on-surface transition-colors">Customers</a>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <a rv-on-click="goToCustomer" href="#" rv-text="header.customerId" class="text-on-surface font-semibold hover:text-secondary transition-colors"></a>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <span class="text-on-surface font-semibold">Withdrawals</span>
  `,
  showSearch: false,
});

const template = `
<div class="min-h-screen">

  ${sidebarTpl}

  <div class="lg:ml-[280px]">

    ${topBarTpl}
    ${desktopTopBarTpl}

    <main class="pt-20 lg:pt-16 pb-28 lg:pb-8 px-margin-mobile lg:px-margin-desktop">
      <div class="mx-auto">

        <div rv-show="noActiveTenant" class="glass-card rounded-xl p-md bg-error/10 border border-error/30 mt-gutter flex items-start gap-sm">
          <span class="material-symbols-outlined text-error shrink-0 mt-xs">hub</span>
          <div>
            <p class="font-body-md text-error font-semibold">No active tenant</p>
            <p class="font-body-sm text-on-surface-variant mt-xs">
              Go to <a rv-on-click="goToTenants" href="#" class="text-secondary underline">Tenants</a> and click <strong>Work with</strong> first.
            </p>
          </div>
        </div>

        <div rv-hide="noActiveTenant" class="pt-gutter">

          ${headerTpl}

          <!-- New Withdrawal form -->
          <div class="glass-card rounded-xl overflow-hidden mb-md">
            <div class="px-md py-sm bg-white/[0.03] border-b border-white/5 flex items-center gap-sm">
              <span class="material-symbols-outlined text-on-surface-variant text-[18px]">arrow_upward</span>
              <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">New Withdrawal</span>
            </div>
            <div class="p-md space-y-sm">

              <div rv-show="form.error" class="flex items-center gap-sm text-error">
                <span class="material-symbols-outlined text-[16px]">error</span>
                <span rv-text="form.error" class="font-body-sm"></span>
              </div>
              <div rv-show="form.success" class="flex items-center gap-sm text-tertiary">
                <span class="material-symbols-outlined text-[16px]">check_circle</span>
                <span rv-text="form.success" class="font-body-sm font-semibold"></span>
              </div>

              <div>
                <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">Destination Address</label>
                <input rv-on-input="form.onAddressInput"
                  class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-mono-data text-[13px] focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none"
                  type="text" placeholder="bcrt1q…" autocomplete="off" />
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-sm">
                <div>
                  <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">Amount (satoshi)</label>
                  <input rv-on-input="form.onAmountInput"
                    class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-mono-data text-[13px] focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none"
                    type="text" placeholder="90000" autocomplete="off" />
                </div>
                <div>
                  <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">Note (optional)</label>
                  <input rv-on-input="form.onNoteInput"
                    class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-body-sm focus:ring-1 focus:ring-secondary transition-all outline-none"
                    type="text" placeholder="Test withdrawal" autocomplete="off" />
                </div>
              </div>

              <button rv-on-click="form.submit" rv-attr-disabled="form.loading"
                class="flex items-center gap-xs bg-secondary text-on-secondary-fixed px-md py-2 rounded-lg font-label-md font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50">
                <span class="material-symbols-outlined text-[18px]">send</span>
                <span rv-hide="form.loading">Submit Withdrawal</span>
                <span rv-show="form.loading">Submitting…</span>
              </button>
            </div>
          </div>

          <!-- Error state -->
          <div rv-show="error" class="glass-card rounded-xl p-md bg-error/10 border border-error/30 mb-md">
            <div class="flex items-center gap-sm">
              <span class="material-symbols-outlined text-error">error</span>
              <span rv-text="error" class="font-body-sm text-error"></span>
            </div>
          </div>

          <!-- Loading -->
          <div rv-show="loading" class="flex justify-center py-lg">
            <div class="w-8 h-8 rounded-full border-2 border-secondary border-t-transparent animate-spin"></div>
          </div>

          <!-- Info: see batches -->
          <div rv-hide="loading" class="glass-card rounded-xl p-md flex items-start gap-sm">
            <span class="material-symbols-outlined text-on-surface-variant shrink-0 mt-xs text-[18px]">info</span>
            <p class="font-body-sm text-on-surface-variant">
              After submitting, the withdrawal enters a batch (batcher runs every 30s).
              Track progress in
              <a rv-on-click="goToBatches" href="#" class="text-secondary underline hover:brightness-110">Withdrawal Batches</a>.
            </p>
          </div>

        </div>
      </div>
    </main>

    ${bottomNavTpl}

  </div>

  ${mobileDrawerTpl}

</div>
`;

export function createController({ api, router, id }) {
  const self = {
    mobileDrawer: createMobileDrawerController(),
    activeTenant: createActiveTenantController(),
    topBar: createTopBarController({
      title: 'Withdrawals',
      breadcrumb: 'Customers > Withdrawals',
      onBack: () => router.navigate('#/customers'),
      onMenuOpen: () => self.mobileDrawer.open(),
    }),
    sidebar: createSidebarController({ activeRoute: ROUTE, router }),
    bottomNav: createBottomNavController({ activeRoute: ROUTE, router }),

    noActiveTenant: !getActiveTenantKey(),
    loading: false,
    error: null,

    header: createCustomerDetailHeaderController({
      customerId: id,
      activeTab: ACTIVE_TAB,
      router,
      onDisable: () => self.disableCustomer(),
    }),

    form: {
      address: '',
      amount: '',
      note: '',
      loading: false,
      error: null,
      success: null,
      onAddressInput(e) { self.form.address = e.target.value; },
      onAmountInput(e)  { self.form.amount  = e.target.value; },
      onNoteInput(e)    { self.form.note    = e.target.value; },
      async submit() {
        self.form.error = null;
        self.form.success = null;

        const address = self.form.address.trim();
        const amountStr = self.form.amount.trim();

        if (!address) { self.form.error = 'Destination address is required'; return; }
        if (!amountStr) { self.form.error = 'Amount is required'; return; }
        try {
          if (BigInt(amountStr) <= 0n) throw new Error('Amount must be > 0');
        } catch {
          self.form.error = 'Amount must be a valid positive integer (satoshi)';
          return;
        }

        self.form.loading = true;
        try {
          const session = await api.createCustomerSession(id);
          const token = session.accessToken || session.token || session.sessionToken;
          if (!token) throw new Error('No session token returned');

          const result = await api.createWithdrawalAsCustomer(token, {
            chain: 'bitcoin',
            assetId: 'bitcoin:BTC',
            amountSats: amountStr,
            toAddress: address,
            note: self.form.note.trim() || undefined,
          });

          self.form.success = `Withdrawal created: ${result.id || 'OK'} — status: ${result.status || 'pending'}`;
          self.form.address = '';
          self.form.amount = '';
          self.form.note = '';
        } catch (e) {
          self.form.error = e.message;
        } finally {
          self.form.loading = false;
        }
      },
    },

    goToTenants(e) { e?.preventDefault(); router.navigate('#/tenants'); },
    goToCustomers(e) { e?.preventDefault(); router.navigate('#/customers'); },
    goToCustomer(e) { e?.preventDefault(); router.navigate(`#/customers/${encodeURIComponent(id)}/profile`); },
    goToBatches(e) { e?.preventDefault(); router.navigate('#/withdrawal-batches'); },

    async disableCustomer() {
      self.header.disableLoading = true;
      try {
        await api.disableCustomer(id);
        self.header.canDisable = false;
        self.header.statusLabel = 'DISABLED';
        self.header.statusBadgeClass = 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-error/10 text-error border border-error/20';
      } catch (e) {
        self.error = e.message;
      } finally {
        self.header.disableLoading = false;
      }
    },

    async load() {
      self.loading = true;
      self.error = null;
      try {
        const [customer, profileData, contactData] = await Promise.all([
          api.getCustomer(id),
          safeLoad(() => api.getCustomerProfile(id)),
          safeLoad(() => api.getCustomerContact(id)),
        ]);
        self.header.setCustomer(customer);
        self.header.setProfile(profileData);
        self.header.setContact(contactData);
      } catch (e) {
        self.error = e.message;
      } finally {
        self.loading = false;
      }
    },

    init() {
      if (!self.noActiveTenant) self.load();
    },
  };
  return self;
}

export const CustomerWithdrawalsView = {
  mount(el, params, { api, router }) {
    el.innerHTML = template;
    const scope = createController({ api, router, id: params.id });
    const binding = rivets.bind(el, scope);
    scope.init();
    return { unbind() { binding.unbind(); } };
  },
};
