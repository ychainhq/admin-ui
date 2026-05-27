import rivets from '../rivets.js';
import { template as topBarTpl, createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl, createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl, createSidebarController } from '../components/DesktopSidebar.js';
import { template as mobileDrawerTpl, createMobileDrawerController } from '../components/MobileDrawer.js';
import { desktopTopBarHtml } from '../components/DesktopTopBar.js';
import { createActiveTenantController } from '../components/ActiveTenantBadge.js';
import { opCardHtml } from '../components/NodeOpCard.js';
import { template as paginationTpl, createPaginationController } from '../components/Pagination.js';

const ROUTE = '/wallets';
const PER_PAGE = 20;

function labelize(value) {
  return String(value || '—').replace(/_/g, ' ').toUpperCase();
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString();
}

const preFundBodyHtml = `
<div class="space-y-sm">
  <div class="flex items-center gap-sm p-sm rounded-lg bg-white/5 border border-white/10">
    <span class="material-symbols-outlined text-on-surface-variant text-[16px] shrink-0">location_on</span>
    <div class="flex-1 min-w-0">
      <p class="text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-0.5">Target Address</p>
      <p rv-show="preFund.hasAddress" rv-text="preFund.toAddress" class="font-mono-data text-secondary text-[12px] break-all"></p>
      <p rv-hide="preFund.hasAddress" class="font-body-sm text-on-surface-variant italic text-[12px]">Click Pre-fund on an address row below to select target</p>
    </div>
  </div>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-sm">
    <div>
      <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">Source Wallet (Bitcoin Core)</label>
      <select rv-html="preFund.walletOptionsHtml" rv-on-change="preFund.onWalletChange"
        class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-mono-data text-[13px] focus:ring-1 focus:ring-secondary transition-all outline-none">
        <option>Loading wallets…</option>
      </select>
    </div>
    <div>
      <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">Amount (BTC)</label>
      <input rv-on-input="preFund.onAmountInput"
        class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-mono-data text-[13px] focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none"
        type="number" placeholder="0.001" step="0.00000001" min="0.00000001" autocomplete="off" />
    </div>
  </div>
  <div class="grid grid-cols-3 gap-sm items-end">
    <div>
      <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">Confirm blocks</label>
      <input rv-on-input="preFund.onBlocksInput"
        class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-body-sm focus:ring-1 focus:ring-secondary transition-all outline-none"
        type="number" value="1" min="0" max="100" />
    </div>
    <div class="col-span-2">
      <button rv-on-click="preFund.run" rv-attr-disabled="preFund.loading"
        class="w-full flex items-center justify-center gap-xs bg-secondary text-on-secondary-fixed px-md py-2 rounded-lg font-label-md font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50">
        <span class="material-symbols-outlined text-[18px]">send</span>
        Send &amp; Confirm
      </button>
    </div>
  </div>
</div>
`;

const desktopTopBarTpl = desktopTopBarHtml({
  breadcrumbHtml: `
    <span class="text-on-surface-variant">Platform</span>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <a rv-on-click="goToWallets" href="#" class="text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors">Wallets</a>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <span rv-text="walletName" class="text-on-surface-variant"></span>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <span class="text-on-surface font-semibold">Addresses</span>
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
      <div class="mx-auto pt-gutter">

        <div rv-show="error" class="glass-card rounded-xl p-md bg-error/10 border border-error/30 mb-md flex items-center gap-sm">
          <span class="material-symbols-outlined text-error">error</span>
          <span rv-text="error" class="font-body-sm text-error"></span>
        </div>

        <div rv-show="loading" class="flex justify-center py-lg">
          <div class="w-8 h-8 rounded-full border-2 border-secondary border-t-transparent animate-spin"></div>
        </div>

        <div rv-hide="loading">

          <!-- Pre-fund panel — hot wallet only -->
          <div rv-show="canPreFund" class="mb-md max-w-2xl">
            ${opCardHtml({
              icon: 'bolt',
              title: 'Pre-fund Hot Wallet',
              description: 'Send BTC from a Bitcoin Core wallet to a hot wallet address, then mine blocks to confirm',
              scopePrefix: 'preFund',
              bodyHtml: preFundBodyHtml,
            })}
          </div>

          <!-- Address list -->
          <div class="glass-card rounded-xl overflow-hidden">
            <div class="px-md py-sm bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
              <div class="flex items-center gap-sm">
                <span class="material-symbols-outlined text-on-surface-variant text-[18px]">pin_drop</span>
                <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">Addresses</span>
                <span rv-text="walletName" class="font-mono-data text-on-surface text-[12px]"></span>
              </div>
              <button rv-on-click="load" class="flex items-center gap-xs px-sm py-1 rounded-lg border border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all text-[12px]">
                <span class="material-symbols-outlined text-[14px]">refresh</span>
                Refresh
              </button>
            </div>

            <div rv-show="addressesEmpty" class="p-lg text-center">
              <span class="material-symbols-outlined text-[48px] text-on-surface-variant">pin_drop</span>
              <p class="font-body-md text-on-surface-variant mt-sm">No addresses registered for this wallet</p>
            </div>

            <!-- Desktop table -->
            <div rv-hide="addressesEmpty" class="hidden lg:block overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-white/5 bg-white/[0.02]">
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">ADDRESS</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">LABEL</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">TYPE</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">ROLE</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">STATUS</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">CREATED</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">ACTIONS</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  <tr rv-each-addr="addresses" class="hover:bg-white/[0.02]">
                    <td class="px-md py-3 font-mono-data text-on-surface text-[12px] max-w-[240px]">
                      <span rv-text="addr.address" class="block truncate" rv-attr-title="addr.address"></span>
                    </td>
                    <td rv-text="addr.label" class="px-md py-3 font-body-sm text-on-surface-variant"></td>
                    <td rv-text="addr.typeLabel" class="px-md py-3 font-body-sm text-on-surface-variant"></td>
                    <td rv-text="addr.roleLabel" class="px-md py-3 font-body-sm text-on-surface-variant"></td>
                    <td rv-text="addr.statusLabel" class="px-md py-3 font-body-sm text-on-surface-variant"></td>
                    <td rv-text="addr.createdAt" class="px-md py-3 font-body-sm text-on-surface-variant text-[11px]"></td>
                    <td class="px-md py-3">
                      <div class="flex items-center gap-xs">
                        <button rv-on-click="addr.copy"
                          class="flex items-center gap-xs px-sm py-1 rounded-lg border border-white/10 text-on-surface-variant hover:bg-white/5 transition-all text-[12px]">
                          <span class="material-symbols-outlined text-[14px]">content_copy</span>
                          Copy
                        </button>
                        <button rv-show="addr.canPreFund" rv-on-click="addr.selectForPreFund"
                          class="flex items-center gap-xs px-sm py-1 rounded-lg border border-secondary/30 text-secondary hover:bg-secondary/10 transition-all text-[12px] font-bold active:scale-95">
                          <span class="material-symbols-outlined text-[14px]">bolt</span>
                          Pre-fund
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Mobile cards -->
            <div rv-hide="addressesEmpty" class="lg:hidden divide-y divide-white/5">
              <div rv-each-addr="addresses" class="px-md py-3">
                <p rv-text="addr.address" class="font-mono-data text-on-surface text-[12px] break-all mb-xs"></p>
                <div class="flex items-center gap-sm flex-wrap mb-xs">
                  <span rv-text="addr.typeLabel" class="text-[10px] text-on-surface-variant"></span>
                  <span class="text-on-surface-variant opacity-30">·</span>
                  <span rv-text="addr.roleLabel" class="text-[10px] text-on-surface-variant"></span>
                  <span class="text-on-surface-variant opacity-30">·</span>
                  <span rv-text="addr.statusLabel" class="text-[10px] text-on-surface-variant"></span>
                </div>
                <p rv-show="addr.hasLabel" rv-text="addr.label" class="font-body-sm text-on-surface-variant text-[11px] mb-xs"></p>
                <div class="flex items-center gap-xs mt-xs">
                  <button rv-on-click="addr.copy"
                    class="flex items-center gap-xs px-sm py-1 rounded-lg border border-white/10 text-on-surface-variant hover:bg-white/5 transition-all text-[12px]">
                    <span class="material-symbols-outlined text-[14px]">content_copy</span>
                    Copy
                  </button>
                  <button rv-show="addr.canPreFund" rv-on-click="addr.selectForPreFund"
                    class="flex items-center gap-xs px-sm py-1 rounded-lg border border-secondary/30 text-secondary hover:bg-secondary/10 transition-all text-[12px] font-bold active:scale-95">
                    <span class="material-symbols-outlined text-[14px]">bolt</span>
                    Pre-fund
                  </button>
                </div>
              </div>
            </div>

            <!-- Pagination -->
            <div rv-hide="addressesEmpty" class="border-t border-white/5">
              ${paginationTpl}
            </div>

          </div>
        </div>

      </div>
    </main>

    ${bottomNavTpl}

  </div>

  ${mobileDrawerTpl}

</div>
`;

export function createController({ walletId, api, router }) {
  const self = {
    mobileDrawer: createMobileDrawerController(),
    activeTenant: createActiveTenantController(),
    topBar: createTopBarController({
      title: 'Addresses',
      breadcrumb: 'Wallets > Addresses',
      onBack: () => router.navigate('#/wallets'),
      onMenuOpen: () => self.mobileDrawer.open(),
    }),
    sidebar: createSidebarController({ activeRoute: ROUTE, router }),
    bottomNav: createBottomNavController({ activeRoute: ROUTE, router }),

    walletId,
    walletName: walletId,
    loading: false,
    error: null,
    canPreFund: false,
    addresses: [],
    addressesEmpty: true,

    pagination: createPaginationController({ page: 1, total: 0, onPageChange: () => {} }),
    _cursor: undefined,
    _prevCursors: [],
    _nextCursor: undefined,

    preFund: {
      walletOptionsHtml: '<option value="" disabled selected>Loading wallets…</option>',
      fromWallet: '',
      toAddress: '',
      hasAddress: false,
      amount: '',
      blocks: '1',
      loading: false,
      error: null,
      result: null,
      onWalletChange(e) { self.preFund.fromWallet = e.target.value; },
      onAmountInput(e) { self.preFund.amount = e.target.value; },
      onBlocksInput(e) { self.preFund.blocks = e.target.value; },
      copy() {
        const txt = self.preFund.result;
        if (txt) navigator.clipboard?.writeText(txt)?.catch(() => {});
      },
      async run() {
        const wallet = self.preFund.fromWallet;
        const address = self.preFund.toAddress.trim();
        const amount = parseFloat(self.preFund.amount);
        const blocks = parseInt(self.preFund.blocks, 10);

        if (!wallet)              { self.preFund.error = 'Select a source wallet'; return; }
        if (!address)             { self.preFund.error = 'Select a target address from the list below'; return; }
        if (!amount || amount <= 0) { self.preFund.error = 'Amount must be greater than 0'; return; }
        if (isNaN(blocks) || blocks < 0) { self.preFund.error = 'Confirmation blocks must be 0 or more'; return; }

        self.preFund.loading = true;
        self.preFund.error = null;
        self.preFund.result = null;
        try {
          const sendRes = await api.rpc('sendtoaddress', [address, amount], { wallet });
          if (sendRes?.error) throw new Error(sendRes.error.message || 'sendtoaddress failed');
          const txid = sendRes?.result;
          if (!txid) throw new Error('No txid returned by node');

          let minedCount = 0;
          if (blocks > 0) {
            const addrRes = await api.rpc('getnewaddress', [''], { wallet: 'btcminer' });
            const minerAddr = addrRes?.result;
            if (!minerAddr) throw new Error('Could not get miner address for confirmation');
            const mineRes = await api.rpc('generatetoaddress', [blocks, minerAddr]);
            minedCount = mineRes?.result?.length ?? 0;
          }

          const confirmLabel = minedCount > 0
            ? ` · ${minedCount} block${minedCount !== 1 ? 's' : ''} confirmed`
            : ' · unconfirmed (0 blocks mined)';
          self.preFund.result = txid + confirmLabel;
        } catch (e) {
          self.preFund.error = e.message;
        } finally {
          self.preFund.loading = false;
        }
      },
    },

    goToWallets(e) { e?.preventDefault(); router.navigate('#/wallets'); },

    async load() {
      self.loading = true;
      self.error = null;
      try {
        const res = await api.getWalletAddresses(walletId, { limit: PER_PAGE, cursor: self._cursor });
        const items = res.data || [];
        self._nextCursor = res.pagination?.nextCursor || undefined;
        const currentPage = self._prevCursors.length + 1;

        self.addresses = items.map(a => ({
          id: a.id,
          address: a.address,
          label: a.label || '—',
          hasLabel: !!a.label,
          typeLabel: labelize(a.address_type || 'unknown'),
          roleLabel: labelize(a.address_role),
          statusLabel: labelize(a.status),
          createdAt: formatDate(a.created_at),
          canPreFund: self.canPreFund,
          copy() {
            navigator.clipboard?.writeText(a.address)?.catch(() => {});
          },
          selectForPreFund() {
            self.preFund.toAddress = a.address;
            self.preFund.hasAddress = true;
          },
        }));
        self.addressesEmpty = self.addresses.length === 0;

        self.pagination = createPaginationController({
          page: currentPage,
          total: self._nextCursor
            ? currentPage * PER_PAGE + 1
            : (currentPage - 1) * PER_PAGE + items.length,
          onPageChange(p) {
            if (p > currentPage && self._nextCursor) {
              self._prevCursors.push(self._cursor);
              self._cursor = self._nextCursor;
              self.load();
            } else if (p < currentPage && self._prevCursors.length > 0) {
              self._cursor = self._prevCursors.pop();
              self.load();
            }
          },
        });
      } catch (e) {
        self.error = e.message;
      } finally {
        self.loading = false;
      }
    },

    async init() {
      // Load wallet metadata to get name + determine pre-fund eligibility
      try {
        const w = await api.getWallet(walletId);
        self.walletName = w.name || walletId;
        self.canPreFund = (w.wallet_role === 'tenant_hot');
      } catch {
        // non-critical — walletName stays as walletId
      }

      await self.load();

      // Populate Bitcoin Core wallet dropdown — only needed for hot wallets
      if (self.canPreFund) {
        try {
          const walletsRes = await api.rpc('listwallets', []);
          const names = walletsRes?.result || [];
          const items = await Promise.all(names.map(async (name) => {
            try {
              const r = await api.rpc('getbalances', [], { wallet: name });
              const mine = r?.result?.mine || {};
              const spendable = mine.trusted || 0;
              const immature = mine.immature || 0;
              const balLabel = immature > 0
                ? `${spendable.toFixed(4)} BTC  (+${immature.toFixed(0)} immature)`
                : `${spendable.toFixed(4)} BTC`;
              return { name, label: `${name}  —  ${balLabel}`, spendable };
            } catch {
              return { name, label: `${name}  —  (unavailable)`, spendable: 0 };
            }
          }));
          const defaultWallet = items.find(w => w.spendable > 0) || items[0];
          self.preFund.walletOptionsHtml = items
            .map(w => `<option value="${w.name}"${defaultWallet && w.name === defaultWallet.name ? ' selected' : ''}>${w.label}</option>`)
            .join('');
          if (defaultWallet) self.preFund.fromWallet = defaultWallet.name;
        } catch {
          self.preFund.walletOptionsHtml = '<option value="">Could not load wallets</option>';
        }
      }
    },
  };
  return self;
}

export const WalletAddressesView = {
  mount(el, { walletId }, { api, router }) {
    el.innerHTML = template;
    const scope = createController({ walletId, api, router });
    const binding = rivets.bind(el, scope);
    scope.init();
    return { unbind() { binding.unbind(); } };
  },
};
