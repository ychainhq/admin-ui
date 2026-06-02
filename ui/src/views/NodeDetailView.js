import rivets from '../rivets.js';
import { template as topBarTpl, createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl, createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl, createSidebarController } from '../components/DesktopSidebar.js';
import { template as mobileDrawerTpl, createMobileDrawerController } from '../components/MobileDrawer.js';
import { desktopTopBarHtml } from '../components/DesktopTopBar.js';
import { createActiveTenantController } from '../components/ActiveTenantBadge.js';
import { opCardHtml } from '../components/NodeOpCard.js';
// v3: node data loaded dynamically from API, not from static nodes.js

const ROUTE = '/nodes';

const generateAddrBodyHtml = `
<div class="grid grid-cols-1 sm:grid-cols-2 gap-sm">
  <div>
    <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">Wallet Name</label>
    <input rv-on-input="generateAddr.onWalletInput"
      class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-mono-data text-[13px] focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none"
      type="text" placeholder="my-wallet" autocomplete="off" />
  </div>
  <div>
    <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">Address Type</label>
    <select rv-on-change="generateAddr.onTypeChange"
      class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-body-sm focus:ring-1 focus:ring-secondary transition-all outline-none">
      <option value="bech32">bech32 (bcrt1q…)</option>
      <option value="legacy">legacy (m/n…)</option>
      <option value="p2sh-segwit">p2sh-segwit (2…)</option>
    </select>
  </div>
</div>
<button rv-on-click="generateAddr.run" rv-attr-disabled="generateAddr.loading"
  class="flex items-center gap-xs bg-secondary text-on-secondary-fixed px-md py-2 rounded-lg font-label-md font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50">
  <span class="material-symbols-outlined text-[18px]">add_circle</span>
  Generate Address
</button>
`;

const sendTxBodyHtml = `
<div class="grid grid-cols-1 sm:grid-cols-2 gap-sm">
  <div>
    <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">Source Wallet</label>
    <select rv-html="sendTx.walletOptionsHtml" rv-on-change="sendTx.onWalletChange"
      class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-mono-data text-[13px] focus:ring-1 focus:ring-secondary transition-all outline-none">
      <option>Loading wallets…</option>
    </select>
  </div>
  <div>
    <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">Amount (BTC)</label>
    <input rv-on-input="sendTx.onAmountInput"
      class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-mono-data text-[13px] focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none"
      type="number" placeholder="0.001" step="0.00000001" min="0.00000001" autocomplete="off" />
  </div>
</div>
<div>
  <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">Destination Address</label>
  <input rv-on-input="sendTx.onAddressInput"
    class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-mono-data text-[13px] focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none"
    type="text" placeholder="bcrt1q…" autocomplete="off" />
</div>
<div class="grid grid-cols-3 gap-sm items-end">
  <div>
    <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">Confirm blocks</label>
    <input rv-on-input="sendTx.onBlocksInput"
      class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-body-sm focus:ring-1 focus:ring-secondary transition-all outline-none"
      type="number" value="1" min="0" max="100" />
  </div>
  <div class="col-span-2">
    <button rv-on-click="sendTx.run" rv-attr-disabled="sendTx.loading"
      class="w-full flex items-center justify-center gap-xs bg-secondary text-on-secondary-fixed px-md py-2 rounded-lg font-label-md font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50">
      <span class="material-symbols-outlined text-[18px]">send</span>
      Send & Confirm
    </button>
  </div>
</div>
`;

const mineBlocksBodyHtml = `
<div class="grid grid-cols-1 sm:grid-cols-3 gap-sm">
  <div class="sm:col-span-2">
    <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">Target Address</label>
    <input rv-on-input="mineBlocks.onAddressInput"
      class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-mono-data text-[13px] focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none"
      type="text" placeholder="bcrt1q…" autocomplete="off" />
  </div>
  <div>
    <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">Blocks</label>
    <input rv-on-input="mineBlocks.onCountInput"
      class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-body-sm focus:ring-1 focus:ring-secondary transition-all outline-none"
      type="number" value="10" min="1" max="1000" />
  </div>
</div>
<button rv-on-click="mineBlocks.run" rv-attr-disabled="mineBlocks.loading"
  class="flex items-center gap-xs bg-secondary text-on-secondary-fixed px-md py-2 rounded-lg font-label-md font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50">
  <span class="material-symbols-outlined text-[18px]">bolt</span>
  Mine Blocks
</button>
`;

const template = `
<div class="min-h-screen">

  ${sidebarTpl}

  <div class="lg:ml-[280px]">

    ${topBarTpl}

    ${desktopTopBarHtml({
      breadcrumbHtml: `
        <span class="text-on-surface-variant hover:text-on-surface cursor-pointer transition-colors" rv-on-click="backToNodes">Dev Nodes</span>
        <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
        <span rv-text="nodeLabel" class="text-on-surface font-semibold"></span>
      `,
    })}

    <main class="pt-20 lg:pt-16 pb-28 lg:pb-8 px-margin-mobile lg:px-margin-desktop">
      <div class="mx-auto">

        <!-- Not found -->
        <div rv-show="notFound" class="pt-gutter">
          <div class="glass-card rounded-xl p-md bg-error/10 border border-error/30">
            <div class="flex items-center gap-sm">
              <span class="material-symbols-outlined text-error">error</span>
              <span class="font-body-sm text-error">Node not found: <span rv-text="nodeId" class="font-mono"></span></span>
            </div>
          </div>
        </div>

        <div rv-hide="notFound">

          <!-- Node header -->
          <div class="pt-gutter mb-gutter">
            <div class="flex items-center gap-md">
              <div class="w-14 h-14 rounded-full bg-secondary/10 border border-secondary/20 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-secondary text-[28px]">currency_bitcoin</span>
              </div>
              <div class="flex-1">
                <div class="flex items-center gap-sm mb-xs">
                  <h2 rv-text="nodeLabel" class="text-headline-md font-headline-md text-on-surface"></h2>
                  <span rv-text="nodeNetwork" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-on-surface-variant uppercase tracking-wider"></span>
                </div>
                <div class="flex items-center gap-md">
                  <div class="flex items-center gap-xs">
                    <span rv-show="nodeStatus.checking" class="font-body-sm text-on-surface-variant text-[12px] italic">Checking…</span>
                    <span rv-show="nodeStatus.showOnline" class="w-2 h-2 rounded-full bg-tertiary shrink-0"></span>
                    <span rv-show="nodeStatus.showOnline" class="font-body-sm text-tertiary text-[12px]">Online</span>
                    <span rv-show="nodeStatus.showOffline" class="w-2 h-2 rounded-full bg-error shrink-0"></span>
                    <span rv-show="nodeStatus.showOffline" class="font-body-sm text-error text-[12px]">Offline</span>
                  </div>
                  <span rv-show="nodeStatus.blocksText" class="font-body-sm text-on-surface-variant text-[12px]">
                    Block <span rv-text="nodeStatus.blocksText" class="font-mono text-on-surface text-[12px]"></span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Wallet Operations -->
          <div class="mb-gutter">
            <h3 class="text-[11px] uppercase tracking-widest text-on-surface-variant font-bold mb-gutter flex items-center gap-xs">
              <span class="material-symbols-outlined text-[16px]">account_balance_wallet</span>
              Wallet Operations
            </h3>
            <div class="max-w-2xl space-y-sm">
              ${opCardHtml({
                icon: 'add_circle',
                title: 'Generate New Address',
                description: 'Create or load a named wallet and generate a receive address',
                scopePrefix: 'generateAddr',
                bodyHtml: generateAddrBodyHtml,
              })}
              ${opCardHtml({
                icon: 'send',
                title: 'Send Transaction',
                description: 'Send BTC from a node wallet to any address, then mine N blocks to confirm',
                scopePrefix: 'sendTx',
                bodyHtml: sendTxBodyHtml,
              })}
            </div>
          </div>

          <!-- Mining Operations -->
          <div class="mb-gutter">
            <h3 class="text-[11px] uppercase tracking-widest text-on-surface-variant font-bold mb-gutter flex items-center gap-xs">
              <span class="material-symbols-outlined text-[16px]">bolt</span>
              Mining Operations
            </h3>
            <div class="max-w-2xl">
              ${opCardHtml({
                icon: 'bolt',
                title: 'Mine & Fund Address',
                description: 'Mine blocks in regtest — coinbase reward goes to the target address',
                scopePrefix: 'mineBlocks',
                bodyHtml: mineBlocksBodyHtml,
              })}
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

export function createController({ nodeId, api, router }) {
  // v3: node details loaded from API; nodeId may be a DB id (e.g. 'node_abc123')
  // or legacy 'btc-regtest' — we route RPC calls with the nodeId for v3.
  const self = {
    nodeId,
    mobileDrawer: createMobileDrawerController(),
    activeTenant: createActiveTenantController(),
    topBar: createTopBarController({
      title: 'Node Detail',
      breadcrumb: 'Dev > Chain Nodes > Detail',
      onBack: () => router.navigate('#/nodes'),
      onMenuOpen: () => self.mobileDrawer.open(),
    }),
    sidebar: createSidebarController({ activeRoute: ROUTE, router }),
    bottomNav: createBottomNavController({ activeRoute: ROUTE, router }),

    notFound: false,
    nodeLabel: nodeId,
    nodeNetwork: '',

    nodeStatus: {
      checking: true,
      showOnline: false,
      showOffline: false,
      blocksText: '',
    },

    // ─── Generate Address ────────────────────────────────────────────────────────
    generateAddr: {
      wallet: '',
      addressType: 'bech32',
      loading: false,
      error: null,
      result: null,
      onWalletInput(e) { self.generateAddr.wallet = e.target.value; },
      onTypeChange(e) { self.generateAddr.addressType = e.target.value; },
      async run() {
        const wallet = self.generateAddr.wallet.trim();
        if (!wallet) {
          self.generateAddr.error = 'Wallet name is required';
          return;
        }
        self.generateAddr.loading = true;
        self.generateAddr.error = null;
        self.generateAddr.result = null;
        try {
          await api.rpc('createwallet', [wallet], { nodeId }).catch(() => {});
          await api.rpc('loadwallet', [wallet], { nodeId }).catch(() => {});
          const res = await api.rpc('getnewaddress', ['', self.generateAddr.addressType], { nodeId, wallet });
          const addr = res?.result;
          if (!addr) throw new Error('No address returned by node');
          self.generateAddr.result = addr;
        } catch (e) {
          self.generateAddr.error = e.message;
        } finally {
          self.generateAddr.loading = false;
        }
      },
      copy() {
        if (self.generateAddr.result) navigator.clipboard.writeText(self.generateAddr.result).catch(() => {});
      },
    },

    // ─── Send Transaction ─────────────────────────────────────────────────────────
    sendTx: {
      walletOptionsHtml: '<option value="" disabled selected>Loading wallets…</option>',
      fromWallet: '',
      toAddress: '',
      amount: '',
      blocks: '1',
      loading: false,
      error: null,
      result: null,
      _txid: null,
      onWalletChange(e) { self.sendTx.fromWallet = e.target.value; },
      onAddressInput(e) { self.sendTx.toAddress = e.target.value; },
      onAmountInput(e) { self.sendTx.amount = e.target.value; },
      onBlocksInput(e) { self.sendTx.blocks = e.target.value; },
      copy() {
        const txt = self.sendTx._txid || self.sendTx.result;
        if (txt) navigator.clipboard.writeText(txt).catch(() => {});
      },
      async run() {
        const wallet = self.sendTx.fromWallet;
        const address = self.sendTx.toAddress.trim();
        const amount = parseFloat(self.sendTx.amount);
        const blocks = parseInt(self.sendTx.blocks, 10);

        if (!wallet)          { self.sendTx.error = 'Select a source wallet'; return; }
        if (!address)         { self.sendTx.error = 'Destination address is required'; return; }
        if (!amount || amount <= 0) { self.sendTx.error = 'Amount must be greater than 0'; return; }
        if (isNaN(blocks) || blocks < 0) { self.sendTx.error = 'Confirmation blocks must be 0 or more'; return; }

        self.sendTx.loading = true;
        self.sendTx.error = null;
        self.sendTx.result = null;
        self.sendTx._txid = null;
        try {
          // Send tx via this node, mine confirmations via miner node (btc-node-1)
          const sendRes = await api.rpc('sendtoaddress', [address, amount], { nodeId, wallet });
          if (sendRes?.error) throw new Error(sendRes.error.message || 'sendtoaddress failed');
          const txid = sendRes?.result;
          if (!txid) throw new Error('No txid returned by node');
          self.sendTx._txid = txid;

          let minedCount = 0;
          if (blocks > 0) {
            // Mine confirmation blocks using the /mining/generate endpoint
            // (always uses miner node = btc-node-1 in regtest)
            const mineRes = await api.mineBlocks(blocks);
            minedCount = Array.isArray(mineRes?.result) ? mineRes.result.length : 0;
          }

          const confirmLabel = minedCount > 0
            ? ` · ${minedCount} block${minedCount !== 1 ? 's' : ''} confirmed`
            : ' · unconfirmed (0 blocks mined)';
          self.sendTx.result = txid + confirmLabel;
        } catch (e) {
          self.sendTx.error = e.message;
        } finally {
          self.sendTx.loading = false;
        }
      },
    },

    // ─── Mine & Fund ─────────────────────────────────────────────────────────────
    mineBlocks: {
      address: '',
      count: '10',
      loading: false,
      error: null,
      result: null,
      onAddressInput(e) { self.mineBlocks.address = e.target.value; },
      onCountInput(e) { self.mineBlocks.count = e.target.value; },
      async run() {
        const address = self.mineBlocks.address.trim();
        const count = parseInt(self.mineBlocks.count, 10) || 10;
        if (!address) {
          self.mineBlocks.error = 'Target address is required';
          return;
        }
        if (count < 1 || count > 1000) {
          self.mineBlocks.error = 'Block count must be between 1 and 1000';
          return;
        }
        self.mineBlocks.loading = true;
        self.mineBlocks.error = null;
        self.mineBlocks.result = null;
        try {
          // Mine via /mining/generate endpoint (always uses miner node)
          const res = await api.mineBlocks(count, address);
          const hashes = res?.result;
          if (!Array.isArray(hashes)) throw new Error('Unexpected response from node');
          self.mineBlocks.result = `Mined ${hashes.length} block${hashes.length !== 1 ? 's' : ''} · ${hashes.length * 50} BTC → ${address}`;
        } catch (e) {
          self.mineBlocks.error = e.message;
        } finally {
          self.mineBlocks.loading = false;
        }
      },
      copy() {
        if (self.mineBlocks.address) navigator.clipboard.writeText(self.mineBlocks.address).catch(() => {});
      },
    },

    backToNodes() { router.navigate('#/nodes'); },

    async init() {
      // v3: load node details from API (chain_nodes table)
      try {
        const res = await api.getChainNode(nodeId);
        const n   = res?.data ?? {};
        self.nodeLabel   = n.label || nodeId;
        self.nodeNetwork = n.network || '';
        self.notFound    = false;
      } catch {
        // Legacy mode: node not in DB (v2 static node or btc-regtest fallback)
        self.notFound = false;
        self.nodeLabel   = nodeId;
        self.nodeNetwork = 'regtest';
      }

      // v3: RPC calls pass nodeId so proxy routes to the right BTC node
      const rpcOpts = { nodeId };

      // Node status — use nodeId for routing
      try {
        const res = await api.rpc('getblockchaininfo', [], rpcOpts);
        const info = res?.result;
        self.nodeStatus = {
          checking: false,
          showOnline: !!info,
          showOffline: !info,
          blocksText: info?.blocks != null ? String(info.blocks) : '',
        };
      } catch {
        self.nodeStatus = { checking: false, showOnline: false, showOffline: true, blocksText: '' };
      }

      // Populate wallet selector with balances — route to this specific node
      try {
        const walletsRes = await api.rpc('listwallets', [], rpcOpts);
        const names = walletsRes?.result || [];
        const items = await Promise.all(names.map(async (name) => {
          try {
            const r = await api.rpc('getbalances', [], { ...rpcOpts, wallet: name });
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
        self.sendTx.walletOptionsHtml = items
          .map(w => `<option value="${w.name}"${defaultWallet && w.name === defaultWallet.name ? ' selected' : ''}>${w.label}</option>`)
          .join('');
        if (defaultWallet) self.sendTx.fromWallet = defaultWallet.name;
      } catch {
        self.sendTx.walletOptionsHtml = '<option value="">Could not load wallets</option>';
      }
    },
  };
  return self;
}

export const NodeDetailView = {
  mount(el, { nodeId }, { api, router }) {
    el.innerHTML = template;
    const scope = createController({ nodeId, api, router });
    const binding = rivets.bind(el, scope);
    scope.init();
    return { unbind() { binding.unbind(); } };
  },
};
