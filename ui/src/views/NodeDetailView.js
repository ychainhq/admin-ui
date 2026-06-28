import rivets from '../rivets.js';
import { template as topBarTpl, createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl, createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl, createSidebarController } from '../components/DesktopSidebar.js';
import { template as mobileDrawerTpl, createMobileDrawerController } from '../components/MobileDrawer.js';
import { desktopTopBarHtml } from '../components/DesktopTopBar.js';
import { createActiveTenantController } from '../components/ActiveTenantBadge.js';
import { opCardHtml } from '../components/NodeOpCard.js';

const ROUTE = '/nodes';

// ─── TRON address helper (no external deps) ───────────────────────────────────
// Converts a TRON base58check address to 20-byte hex for ABI parameter encoding.
function tronAddrToAbiHex(base58Addr) {
  const ALPHA = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const bytes = [0];
  for (const c of base58Addr) {
    let carry = ALPHA.indexOf(c);
    if (carry < 0) throw new Error('Invalid address character');
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) { bytes.push(carry & 0xff); carry >>= 8; }
  }
  for (let i = 0; i < base58Addr.length && base58Addr[i] === '1'; i++) bytes.push(0);
  const buf = bytes.reverse(); // 25 bytes: 0x41 prefix + 20 addr + 4 checksum
  return buf.slice(1, 21).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── BTC: Generate Address ─────────────────────────────────────────────────────
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

// ─── BTC: Send Transaction ─────────────────────────────────────────────────────
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

// ─── BTC: Mine Blocks ──────────────────────────────────────────────────────────
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

// ─── TRON: Account Inspector ───────────────────────────────────────────────────
const accountInspectorBodyHtml = `
<div>
  <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">TRON Address</label>
  <input rv-on-input="accountInspector.onAddressInput"
    class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-mono-data text-[13px] focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none"
    type="text" placeholder="TXxx…" autocomplete="off" />
</div>
<button rv-on-click="accountInspector.run" rv-attr-disabled="accountInspector.loading"
  class="flex items-center gap-xs bg-secondary text-on-secondary-fixed px-md py-2 rounded-lg font-label-md font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50">
  <span class="material-symbols-outlined text-[18px]">search</span>
  Inspect Account
</button>
`;

// ─── TRON: TRC-20 Balance ──────────────────────────────────────────────────────
const trc20BalanceBodyHtml = `
<div class="grid grid-cols-1 sm:grid-cols-2 gap-sm">
  <div>
    <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">Wallet Address</label>
    <input rv-on-input="trc20Balance.onAddressInput"
      class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-mono-data text-[13px] focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none"
      type="text" placeholder="TXxx…" autocomplete="off" />
  </div>
  <div>
    <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">Contract Address (USDT / TRC-20)</label>
    <input rv-on-input="trc20Balance.onContractInput" rv-value="trc20Balance.contract"
      class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-mono-data text-[13px] focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none"
      type="text" placeholder="TUSDT contract…" autocomplete="off" />
  </div>
</div>
<button rv-on-click="trc20Balance.run" rv-attr-disabled="trc20Balance.loading"
  class="flex items-center gap-xs bg-secondary text-on-secondary-fixed px-md py-2 rounded-lg font-label-md font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50">
  <span class="material-symbols-outlined text-[18px]">token</span>
  Check TRC-20 Balance
</button>
`;

// ─── TRON: Fund TRX ───────────────────────────────────────────────────────────
const fundTrxBodyHtml = `
<div class="grid grid-cols-1 sm:grid-cols-2 gap-sm">
  <div>
    <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">Recipient Address</label>
    <input rv-on-input="fundTrx.onAddressInput"
      class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-mono-data text-[13px] focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none"
      type="text" placeholder="TXxx…" autocomplete="off" />
  </div>
  <div>
    <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">Amount (TRX)</label>
    <input rv-on-input="fundTrx.onAmountInput"
      class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-mono-data text-[13px] focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none"
      type="number" placeholder="10" step="0.000001" min="0.000001" autocomplete="off" />
  </div>
</div>
<button rv-on-click="fundTrx.run" rv-attr-disabled="fundTrx.loading"
  class="flex items-center gap-xs bg-secondary text-on-secondary-fixed px-md py-2 rounded-lg font-label-md font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50">
  <span class="material-symbols-outlined text-[18px]">send</span>
  Fund TRX
</button>
`;

// ─── TRON: Fund USDT ──────────────────────────────────────────────────────────
const fundUsdtBodyHtml = `
<div>
  <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">Recipient Address</label>
  <input rv-on-input="fundUsdt.onAddressInput"
    class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-mono-data text-[13px] focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none"
    type="text" placeholder="TXxx…" autocomplete="off" />
</div>
<div class="grid grid-cols-1 sm:grid-cols-2 gap-sm">
  <div>
    <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">Amount (USDT)</label>
    <input rv-on-input="fundUsdt.onAmountInput"
      class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-mono-data text-[13px] focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none"
      type="number" placeholder="100" step="0.000001" min="0.000001" autocomplete="off" />
  </div>
  <div>
    <label class="block text-[10px] uppercase tracking-wider text-on-surface-variant font-bold mb-xs">USDT Contract Address</label>
    <input rv-on-input="fundUsdt.onContractInput" rv-value="fundUsdt.contractAddress"
      class="w-full bg-surface-container-low border border-white/10 rounded-lg px-sm py-2 text-on-surface font-mono-data text-[13px] focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none"
      type="text" placeholder="TUSDT…" autocomplete="off" />
  </div>
</div>
<button rv-on-click="fundUsdt.run" rv-attr-disabled="fundUsdt.loading"
  class="flex items-center gap-xs bg-secondary text-on-secondary-fixed px-md py-2 rounded-lg font-label-md font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50">
  <span class="material-symbols-outlined text-[18px]">send</span>
  Fund USDT
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
                <span rv-text="nodeIcon" class="material-symbols-outlined text-secondary text-[28px]"></span>
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

          <!-- ══ BITCOIN operations ══════════════════════════════════════════════ -->

          <div rv-show="isBitcoin" class="mb-gutter">
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

          <div rv-show="isBitcoin" class="mb-gutter">
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

          <!-- ══ TRON operations ════════════════════════════════════════════════ -->

          <div rv-show="isTron" class="mb-gutter">
            <h3 class="text-[11px] uppercase tracking-widest text-on-surface-variant font-bold mb-gutter flex items-center gap-xs">
              <span class="material-symbols-outlined text-[16px]">manage_search</span>
              Account Inspector
            </h3>
            <div class="max-w-2xl space-y-sm">
              ${opCardHtml({
                icon: 'account_circle',
                title: 'Inspect Account',
                description: 'Query TRX balance, free bandwidth, and staked energy for any TRON address',
                scopePrefix: 'accountInspector',
                bodyHtml: accountInspectorBodyHtml,
              })}
              ${opCardHtml({
                icon: 'token',
                title: 'TRC-20 Balance',
                description: 'Read token balance (USDT or any TRC-20) for a wallet address via constant call',
                scopePrefix: 'trc20Balance',
                bodyHtml: trc20BalanceBodyHtml,
              })}
            </div>
          </div>

          <div rv-show="tronFundEnabled" class="mb-gutter">
            <h3 class="text-[11px] uppercase tracking-widest text-on-surface-variant font-bold mb-gutter flex items-center gap-xs">
              <span class="material-symbols-outlined text-[16px]">send</span>
              Dev Faucet
            </h3>
            <div class="max-w-2xl space-y-sm">
              ${opCardHtml({
                icon: 'currency_exchange',
                title: 'Fund with TRX',
                description: 'Send TRX from the dev account to any address — for seeding test deposit addresses',
                scopePrefix: 'fundTrx',
                bodyHtml: fundTrxBodyHtml,
              })}
              ${opCardHtml({
                icon: 'payments',
                title: 'Fund with USDT',
                description: 'Transfer TRC-20 USDT from the dev account to any address',
                scopePrefix: 'fundUsdt',
                bodyHtml: fundUsdtBodyHtml,
              })}
            </div>
          </div>

          <!-- TRON: no dev key configured -->
          <div rv-show="tronNoDevKey" class="max-w-2xl">
            <div class="glass-card rounded-xl p-md border border-white/10 flex items-start gap-sm">
              <span class="material-symbols-outlined text-on-surface-variant text-[20px] shrink-0 mt-0.5">info</span>
              <div class="space-y-xs">
                <p class="font-label-md text-on-surface font-bold">Dev faucet not configured</p>
                <p class="font-body-sm text-on-surface-variant text-[12px]">
                  Set <span class="font-mono text-secondary">TRON_DEV_PRIVATE_KEY</span> and
                  <span class="font-mono text-secondary">TRON_DEV_ADDRESS</span> in the proxy env
                  to enable TRX / USDT funding operations.
                  Optionally set <span class="font-mono text-secondary">TRON_USDT_CONTRACT</span>
                  to pre-fill the USDT contract address.
                </p>
              </div>
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
    nodeIcon: 'currency_bitcoin',

    isBitcoin: true,
    isTron: false,
    tronFundEnabled: false,
    tronNoDevKey: false,

    nodeStatus: {
      checking: true,
      showOnline: false,
      showOffline: false,
      blocksText: '',
    },

    // ─── BTC: Generate Address ────────────────────────────────────────────────
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
        if (!wallet) { self.generateAddr.error = 'Wallet name is required'; return; }
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

    // ─── BTC: Send Transaction ────────────────────────────────────────────────
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
        const wallet  = self.sendTx.fromWallet;
        const address = self.sendTx.toAddress.trim();
        const amount  = parseFloat(self.sendTx.amount);
        const blocks  = parseInt(self.sendTx.blocks, 10);

        if (!wallet)               { self.sendTx.error = 'Select a source wallet'; return; }
        if (!address)              { self.sendTx.error = 'Destination address is required'; return; }
        if (!amount || amount <= 0){ self.sendTx.error = 'Amount must be greater than 0'; return; }
        if (isNaN(blocks) || blocks < 0){ self.sendTx.error = 'Confirmation blocks must be 0 or more'; return; }

        self.sendTx.loading = true;
        self.sendTx.error = null;
        self.sendTx.result = null;
        self.sendTx._txid = null;
        try {
          const sendRes = await api.rpc('sendtoaddress', [address, amount], { nodeId, wallet });
          if (sendRes?.error) throw new Error(sendRes.error.message || 'sendtoaddress failed');
          const txid = sendRes?.result;
          if (!txid) throw new Error('No txid returned by node');
          self.sendTx._txid = txid;

          let minedCount = 0;
          if (blocks > 0) {
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

    // ─── BTC: Mine Blocks ─────────────────────────────────────────────────────
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
        const count   = parseInt(self.mineBlocks.count, 10) || 10;
        if (!address) { self.mineBlocks.error = 'Target address is required'; return; }
        if (count < 1 || count > 1000) { self.mineBlocks.error = 'Block count must be between 1 and 1000'; return; }
        self.mineBlocks.loading = true;
        self.mineBlocks.error = null;
        self.mineBlocks.result = null;
        try {
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

    // ─── TRON: Account Inspector ──────────────────────────────────────────────
    accountInspector: {
      address: '',
      loading: false,
      error: null,
      result: null,
      onAddressInput(e) { self.accountInspector.address = e.target.value; },
      copy() {
        if (self.accountInspector.result) navigator.clipboard.writeText(self.accountInspector.result).catch(() => {});
      },
      async run() {
        const address = self.accountInspector.address.trim();
        if (!address) { self.accountInspector.error = 'Address required'; return; }
        self.accountInspector.loading = true;
        self.accountInspector.error = null;
        self.accountInspector.result = null;
        try {
          const [acctRes, resRes] = await Promise.all([
            api.tronRpc('wallet/getaccount', { address, visible: true }),
            api.tronRpc('wallet/getaccountresource', { address, visible: true }),
          ]);
          const balanceSun = Number(acctRes?.balance ?? 0);
          const balanceTrx = (balanceSun / 1_000_000).toFixed(6);
          const freeBwLimit = resRes?.freeNetLimit ?? 600;
          const freeBwUsed  = resRes?.freeNetUsed  ?? 0;
          const stakedBw    = (resRes?.NetLimit ?? 0) - (resRes?.NetUsed ?? 0);
          const energy      = (resRes?.EnergyLimit ?? 0) - (resRes?.EnergyUsed ?? 0);
          self.accountInspector.result =
            `${balanceTrx} TRX  ·  Free BW: ${freeBwLimit - freeBwUsed}/${freeBwLimit}  ·  Staked BW: ${stakedBw}  ·  Energy: ${energy}`;
        } catch (e) {
          self.accountInspector.error = e.message;
        } finally {
          self.accountInspector.loading = false;
        }
      },
    },

    // ─── TRON: TRC-20 Balance ─────────────────────────────────────────────────
    trc20Balance: {
      address: '',
      contract: '',
      loading: false,
      error: null,
      result: null,
      onAddressInput(e) { self.trc20Balance.address = e.target.value; },
      onContractInput(e) { self.trc20Balance.contract = e.target.value; },
      copy() {
        if (self.trc20Balance.result) navigator.clipboard.writeText(self.trc20Balance.result).catch(() => {});
      },
      async run() {
        const address  = self.trc20Balance.address.trim();
        const contract = self.trc20Balance.contract.trim();
        if (!address)  { self.trc20Balance.error = 'Address required'; return; }
        if (!contract) { self.trc20Balance.error = 'Contract address required'; return; }
        self.trc20Balance.loading = true;
        self.trc20Balance.error = null;
        self.trc20Balance.result = null;
        try {
          const addr20hex = tronAddrToAbiHex(address);
          const parameter = addr20hex.padStart(64, '0'); // balanceOf(address)
          const res = await api.tronRpc('wallet/triggerconstantcontract', {
            owner_address:     address,
            contract_address:  contract,
            function_selector: 'balanceOf(address)',
            parameter,
            visible: true,
          });
          const hexResult = res?.constant_result?.[0];
          if (!hexResult) throw new Error(res?.result?.message || 'No result from contract — check addresses');
          const balanceMicro = BigInt('0x' + hexResult);
          const balanceDisplay = (Number(balanceMicro) / 1_000_000).toFixed(6);
          self.trc20Balance.result = `${balanceDisplay} USDT  (${balanceMicro.toString()} µUSDT)`;
        } catch (e) {
          self.trc20Balance.error = e.message;
        } finally {
          self.trc20Balance.loading = false;
        }
      },
    },

    // ─── TRON: Fund TRX ──────────────────────────────────────────────────────
    fundTrx: {
      toAddress: '',
      amount: '',
      loading: false,
      error: null,
      result: null,
      onAddressInput(e) { self.fundTrx.toAddress = e.target.value; },
      onAmountInput(e) { self.fundTrx.amount = e.target.value; },
      copy() {
        if (self.fundTrx.result) navigator.clipboard.writeText(self.fundTrx.result).catch(() => {});
      },
      async run() {
        const toAddress = self.fundTrx.toAddress.trim();
        const amountTrx = parseFloat(self.fundTrx.amount);
        if (!toAddress)               { self.fundTrx.error = 'Recipient address required'; return; }
        if (!amountTrx || amountTrx <= 0) { self.fundTrx.error = 'Amount must be greater than 0'; return; }
        self.fundTrx.loading = true;
        self.fundTrx.error = null;
        self.fundTrx.result = null;
        try {
          const amountSun = String(Math.round(amountTrx * 1_000_000));
          const res = await api.tronFund({ toAddress, amount: amountSun, asset: 'trx' });
          self.fundTrx.result = `Sent ${amountTrx} TRX · txid: ${res.txid}`;
        } catch (e) {
          self.fundTrx.error = e.message;
        } finally {
          self.fundTrx.loading = false;
        }
      },
    },

    // ─── TRON: Fund USDT ──────────────────────────────────────────────────────
    fundUsdt: {
      toAddress: '',
      amount: '',
      contractAddress: '',
      loading: false,
      error: null,
      result: null,
      onAddressInput(e) { self.fundUsdt.toAddress = e.target.value; },
      onAmountInput(e) { self.fundUsdt.amount = e.target.value; },
      onContractInput(e) { self.fundUsdt.contractAddress = e.target.value; },
      copy() {
        if (self.fundUsdt.result) navigator.clipboard.writeText(self.fundUsdt.result).catch(() => {});
      },
      async run() {
        const toAddress      = self.fundUsdt.toAddress.trim();
        const amountUsdt     = parseFloat(self.fundUsdt.amount);
        const contractAddress = self.fundUsdt.contractAddress.trim();
        if (!toAddress)                { self.fundUsdt.error = 'Recipient address required'; return; }
        if (!amountUsdt || amountUsdt <= 0){ self.fundUsdt.error = 'Amount must be greater than 0'; return; }
        if (!contractAddress)           { self.fundUsdt.error = 'USDT contract address required'; return; }
        self.fundUsdt.loading = true;
        self.fundUsdt.error = null;
        self.fundUsdt.result = null;
        try {
          const amountMicro = String(Math.round(amountUsdt * 1_000_000));
          const res = await api.tronFund({ toAddress, amount: amountMicro, asset: 'usdt', contractAddress });
          self.fundUsdt.result = `Sent ${amountUsdt} USDT · txid: ${res.txid}`;
        } catch (e) {
          self.fundUsdt.error = e.message;
        } finally {
          self.fundUsdt.loading = false;
        }
      },
    },

    backToNodes() { router.navigate('#/nodes'); },

    async init() {
      // Load node details from API (chain_nodes table)
      let chainId = 'bitcoin';
      try {
        const res = await api.getChainNode(nodeId);
        const n = res?.data ?? {};
        self.nodeLabel   = n.label || nodeId;
        self.nodeNetwork = n.network || '';
        chainId = n.chain_id || n.chainId || 'bitcoin';
        self.notFound = false;
      } catch {
        self.nodeLabel   = nodeId;
        self.nodeNetwork = 'regtest';
      }

      const isTron = chainId === 'tron';
      self.isBitcoin = !isTron;
      self.isTron    = isTron;
      self.nodeIcon  = isTron ? 'hexagon' : 'currency_bitcoin';

      // Load proxy config to get TRON dev key status and USDT contract
      try {
        const cfg = await api.getConfig();
        if (isTron) {
          self.tronFundEnabled = !!cfg?.hasTronDevKey;
          self.tronNoDevKey    = !cfg?.hasTronDevKey;
          if (cfg?.tronUsdtContract) {
            self.trc20Balance.contract     = cfg.tronUsdtContract;
            self.fundUsdt.contractAddress  = cfg.tronUsdtContract;
          }
        }
      } catch { /* proxy config optional */ }

      // Node status check
      if (isTron) {
        try {
          // Use testNodeConnection so we query *this* node's rpc_url, not the proxy's
          // fixed TRON_NODE_URL (which always points to node-1 regardless of nodeId).
          const r = await api.testNodeConnection(nodeId);
          const blockNum = r?.data?.blocks ?? null;
          self.nodeStatus = {
            checking: false,
            showOnline:  blockNum != null,
            showOffline: blockNum == null,
            blocksText:  blockNum != null ? String(blockNum) : '',
          };
        } catch {
          self.nodeStatus = { checking: false, showOnline: false, showOffline: true, blocksText: '' };
        }
        return; // TRON nodes: no BTC wallet loading needed
      }

      // BTC: check node status
      try {
        const res  = await api.rpc('getblockchaininfo', [], { nodeId });
        const info = res?.result;
        self.nodeStatus = {
          checking: false,
          showOnline:  !!info,
          showOffline: !info,
          blocksText:  info?.blocks != null ? String(info.blocks) : '',
        };
      } catch {
        self.nodeStatus = { checking: false, showOnline: false, showOffline: true, blocksText: '' };
      }

      // BTC: populate wallet selector
      try {
        const walletsRes = await api.rpc('listwallets', [], { nodeId });
        const names = walletsRes?.result || [];
        const items = await Promise.all(names.map(async (name) => {
          try {
            const r = await api.rpc('getbalances', [], { nodeId, wallet: name });
            const mine = r?.result?.mine || {};
            const spendable = mine.trusted || 0;
            const immature  = mine.immature || 0;
            const balLabel  = immature > 0
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
