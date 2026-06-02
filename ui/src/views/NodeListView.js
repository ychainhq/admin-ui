/**
 * NodeListView — v3
 *
 * Shows all registered chain nodes (from chain_nodes DB table via API)
 * plus engine cluster instance health (engine_instances table).
 *
 * v2: static NODES array from nodes.js, single BTC node
 * v3: dynamic from GET /admin-api/chain-nodes + GET /admin-api/cluster/status
 */

import rivets from '../rivets.js';
import { template as topBarTpl, createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl, createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl, createSidebarController } from '../components/DesktopSidebar.js';
import { template as mobileDrawerTpl, createMobileDrawerController } from '../components/MobileDrawer.js';
import { desktopTopBarHtml } from '../components/DesktopTopBar.js';
import { createActiveTenantController } from '../components/ActiveTenantBadge.js';

const ROUTE = '/nodes';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusColor(status) {
  if (status === 'healthy')     return 'text-tertiary';
  if (status === 'degraded')    return 'text-yellow-400';
  if (status === 'unreachable') return 'text-error';
  return 'text-on-surface-variant';
}

function statusDot(status) {
  if (status === 'healthy')     return 'bg-tertiary w-2 h-2 rounded-full shrink-0';
  if (status === 'degraded')    return 'bg-yellow-400 w-2 h-2 rounded-full shrink-0';
  if (status === 'unreachable') return 'bg-error w-2 h-2 rounded-full shrink-0';
  return 'bg-on-surface-variant/40 w-2 h-2 rounded-full shrink-0';
}

function chainIcon(chainId) {
  if (chainId === 'bitcoin')  return 'currency_bitcoin';
  if (chainId === 'ethereum') return 'diamond';
  if (chainId === 'tron')     return 'hexagon';
  return 'hub';
}

function relativeTime(unixSecs) {
  if (!unixSecs) return '';
  const diff = Math.floor(Date.now() / 1000 - unixSecs);
  if (diff < 5)    return 'just now';
  if (diff < 60)   return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

// ─── Templates ───────────────────────────────────────────────────────────────

const chainNodeCardTpl = `
<div rv-each-node="chainNodes" class="glass-card rounded-xl p-md flex items-center gap-md">
  <div class="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center border border-secondary/20 shrink-0">
    <span rv-text="node.chainIconName" class="material-symbols-outlined text-secondary text-[24px]"></span>
  </div>
  <div class="flex-1 min-w-0">
    <div class="flex items-center gap-sm mb-xs flex-wrap">
      <p rv-text="node.label" class="font-label-md text-on-surface font-bold"></p>
      <span rv-text="node.network" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-on-surface-variant uppercase tracking-wider"></span>
      <span rv-text="node.role" class="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-on-surface-variant font-mono"></span>
    </div>
    <div class="flex items-center gap-md flex-wrap">
      <div class="flex items-center gap-xs">
        <span rv-attr-class="node.dotClass" class="w-2 h-2 rounded-full shrink-0"></span>
        <span rv-attr-class="node.statusClass" rv-text="node.status" class="text-[12px] capitalize"></span>
      </div>
      <span rv-show="node.blockHeightText" class="text-on-surface-variant text-[12px]">
        Block <span rv-text="node.blockHeightText" class="font-mono text-on-surface text-[12px]"></span>
      </span>
      <span rv-show="node.lastCheckedText" class="text-on-surface-variant text-[12px]">
        Checked <span rv-text="node.lastCheckedText" class="text-on-surface text-[12px]"></span>
      </span>
      <span rv-show="node.priority" class="text-on-surface-variant text-[12px]">
        Priority <span rv-text="node.priority" class="font-mono text-on-surface text-[12px]"></span>
      </span>
    </div>
    <p rv-text="node.rpcUrl" class="font-mono text-[11px] text-on-surface-variant mt-xs truncate max-w-xs"></p>
  </div>
  <div class="flex flex-col items-end gap-sm shrink-0">
    <button rv-on-click="node.testConnection"
      class="flex items-center gap-xs text-[12px] text-secondary hover:text-secondary/80 transition-all">
      <span class="material-symbols-outlined text-[16px]">wifi_tethering</span>
      Test
    </button>
    <button rv-on-click="node.openDetail"
      class="flex items-center gap-xs text-[12px] text-on-surface-variant hover:text-on-surface transition-all">
      <span class="material-symbols-outlined text-[16px]">open_in_new</span>
      Detail
    </button>
  </div>
</div>
`;

const engineInstanceTpl = `
<div rv-each-engine="engineInstances" class="glass-card rounded-xl p-md flex items-center gap-md">
  <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
    <span class="material-symbols-outlined text-primary text-[20px]">memory</span>
  </div>
  <div class="flex-1 min-w-0">
    <div class="flex items-center gap-sm mb-xs flex-wrap">
      <p rv-text="engine.shortId" class="font-mono text-[13px] text-on-surface font-bold"></p>
      <span rv-show="engine.isSelf" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary/20 text-secondary uppercase tracking-wider">this</span>
      <span rv-show="engine.version" rv-text="engine.version" class="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-on-surface-variant font-mono"></span>
    </div>
    <div class="flex items-center gap-md flex-wrap">
      <div class="flex items-center gap-xs">
        <span rv-attr-class="engine.dotClass"></span>
        <span rv-attr-class="engine.aliveClass" rv-text="engine.aliveLabel" class="text-[12px]"></span>
      </div>
      <span rv-show="engine.lastSeenText" class="text-on-surface-variant text-[12px]">
        Seen <span rv-text="engine.lastSeenText" class="text-on-surface text-[12px]"></span>
      </span>
    </div>
    <p rv-text="engine.engineUrl" class="font-mono text-[11px] text-on-surface-variant mt-xs"></p>
  </div>
</div>
`;

const miningPanelTpl = `
<div rv-show="hasRegtest" class="glass-card rounded-xl p-md space-y-sm">
  <h3 class="font-label-md font-bold text-on-surface flex items-center gap-xs">
    <span class="material-symbols-outlined text-[18px] text-secondary">generating_tokens</span>
    Mining <span class="text-[11px] text-on-surface-variant font-normal ml-1">(regtest only — btc-node-1)</span>
  </h3>
  <div class="flex items-center gap-sm flex-wrap">
    <input rv-on-input="mining.onInput"
      class="w-20 bg-surface-container-low border border-white/10 rounded-lg px-sm py-1.5 text-on-surface font-mono text-[13px] focus:ring-1 focus:ring-secondary outline-none"
      type="number" min="1" max="100" placeholder="1" />
    <span class="text-on-surface-variant text-[13px]">block(s)</span>
    <button rv-on-click="mining.mine" rv-attr-disabled="mining.loading"
      class="flex items-center gap-xs bg-secondary text-on-secondary-fixed px-md py-1.5 rounded-lg font-label-md font-bold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50">
      <span class="material-symbols-outlined text-[16px]">play_arrow</span>
      Mine
    </button>
  </div>
  <p rv-show="mining.result" rv-text="mining.result" class="font-mono text-[12px] text-tertiary break-all"></p>
  <p rv-show="mining.error" rv-text="mining.error" class="font-mono text-[12px] text-error break-all"></p>
</div>
`;

const template = `
<div class="min-h-screen">
  ${sidebarTpl}
  <div class="lg:ml-[280px]">
    ${topBarTpl}
    ${desktopTopBarHtml({
      breadcrumbHtml: `
        <span class="text-on-surface-variant">Dev</span>
        <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
        <span class="text-on-surface font-semibold">Chain Nodes</span>
      `,
    })}
    <main class="pt-20 lg:pt-16 pb-28 lg:pb-8 px-margin-mobile lg:px-margin-desktop">
      <div class="mx-auto max-w-3xl">

        <div class="pt-gutter mb-gutter flex items-start justify-between gap-md">
          <div>
            <h2 class="text-display-lg font-display-lg text-on-surface mb-xs">Chain Nodes</h2>
            <p class="text-body-md font-body-md text-on-surface-variant">
              Registered blockchain nodes — stateless in v3 (no FWallet, any node handles any request).
            </p>
          </div>
          <button rv-on-click="refresh" class="flex items-center gap-xs text-secondary text-[13px] hover:text-secondary/80 transition-all shrink-0 mt-sm">
            <span class="material-symbols-outlined text-[18px]">refresh</span> Refresh
          </button>
        </div>

        <div rv-show="loading" class="text-center py-xl text-on-surface-variant text-[14px]">Loading…</div>
        <div rv-show="error" rv-text="error" class="text-error text-[13px] mb-gutter"></div>

        <div rv-hide="loading" class="space-y-xl">

          ${miningPanelTpl}

          <div>
            <h3 class="font-label-md font-bold text-on-surface-variant uppercase tracking-wider text-[11px] mb-sm">
              Bitcoin Core Nodes (<span rv-text="chainNodesCount"></span>)
            </h3>
            <div class="space-y-sm">
              ${chainNodeCardTpl}
            </div>
            <div rv-show="noChainNodes" class="glass-card rounded-xl p-md text-on-surface-variant text-[13px]">
              No chain nodes registered yet.
              Use <code class="font-mono text-secondary text-[12px]">POST /admin/v1/chain-nodes</code> to add one.
            </div>
          </div>

          <div>
            <h3 class="font-label-md font-bold text-on-surface-variant uppercase tracking-wider text-[11px] mb-sm">
              Engine Instances (<span rv-text="engineInstancesCount"></span>)
              <span class="text-[10px] font-normal normal-case tracking-normal ml-1 text-on-surface-variant">
                active-active — work distributed via SKIP LOCKED
              </span>
            </h3>
            <div class="space-y-sm">
              ${engineInstanceTpl}
            </div>
            <div rv-show="noEngineInstances" class="glass-card rounded-xl p-md text-on-surface-variant text-[13px]">
              No engine instances. Start with <code class="font-mono text-secondary text-[12px]">CLUSTER_ENABLED=true ENGINE_URL=http://…</code>
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

// ─── Controller ───────────────────────────────────────────────────────────────

export function createController({ api, router }) {
  const self = {
    mobileDrawer: createMobileDrawerController(),
    activeTenant: createActiveTenantController(),
    topBar: createTopBarController({
      title: 'Chain Nodes',
      breadcrumb: 'Dev > Chain Nodes',
      onBack: () => window.history.back(),
      onMenuOpen: () => self.mobileDrawer.open(),
    }),
    sidebar: createSidebarController({ activeRoute: ROUTE, router }),
    bottomNav: createBottomNavController({ activeRoute: ROUTE, router }),

    loading: false,  // starts false — set to true in init() so Rivets detects the change
    error: '',
    chainNodes: [],
    engineInstances: [],
    chainNodesCount: 0,       // Rivets doesn't reliably observe array.length
    engineInstancesCount: 0,  // use explicit counters instead
    noChainNodes: false,      // rv-show helper (Rivets doesn't support !array.length)
    noEngineInstances: false, // rv-show helper
    hasRegtest: false,

    mining: {
      loading: false,
      blocks: 1,
      result: '',
      error: '',
      onInput(e) { self.mining.blocks = parseInt(e.target.value, 10) || 1; },
      async mine() {
        self.mining.loading = true;
        self.mining.result  = '';
        self.mining.error   = '';
        try {
          const res   = await api.mineBlocks(self.mining.blocks);
          const hashes = res?.result ?? [];
          self.mining.result = Array.isArray(hashes)
            ? `Mined ${hashes.length} block(s). Latest: ${String(hashes[hashes.length - 1]).slice(0, 16)}…`
            : JSON.stringify(hashes);
        } catch (err) {
          self.mining.error = err.message;
        } finally {
          self.mining.loading = false;
          setTimeout(() => self.loadChainNodes(), 1500);
        }
      },
    },

    refresh() { self.init(); },

    async loadChainNodes() {
      try {
        const res   = await api.getChainNodes();
        const nodes = res?.data ?? [];
        const mapped = nodes.map(n => ({
          ...n,
          chainIconName:    chainIcon(n.chainId ?? ''),
          statusClass:      statusColor(n.status),
          dotClass:         statusDot(n.status),
          blockHeightText:  n.blockHeight != null ? String(n.blockHeight) : '',
          lastCheckedText:  n.lastCheckedAt ? relativeTime(n.lastCheckedAt) : '',
          priority:         n.priority != null ? String(n.priority) : '',
          openDetail()     { router.navigate(`#/nodes/${encodeURIComponent(n.id)}`); },
          async testConnection() {
            try {
              const r = await api.testNodeConnection(n.id);
              const d = r?.data ?? {};
              alert(`${n.label}\n✓ OK\nChain: ${d.chain ?? '?'}  Blocks: ${d.blocks ?? '?'}`);
            } catch (err) {
              alert(`${n.label}\n✗ ${err.message}`);
            }
          },
        }));
        // Use splice() — Rivets reliably observes array mutations (push/splice/etc.)
        // Full assignment (self.arr = newArr) can miss reactive updates in some Rivets builds.
        self.chainNodes.splice(0, self.chainNodes.length, ...mapped);
        self.chainNodesCount = self.chainNodes.length;
        self.noChainNodes    = self.chainNodes.length === 0;
      } catch (err) {
        self.error = `Failed to load chain nodes: ${err.message}`;
        self.noChainNodes = true;
      }
    },

    async loadEngineInstances() {
      try {
        const res  = await api.getClusterStatus();
        const d    = res?.data ?? {};
        const myId = d.instanceId ?? '';
        const mapped = (d.instances ?? []).map(inst => {
          const seenSecs = inst.lastSeenAt ?? 0;
          const diffSec  = Math.floor(Date.now() / 1000) - seenSecs;
          const alive    = diffSec < 60;
          return {
            ...inst,
            shortId:      (inst.id ?? '').slice(0, 28) + '…',
            isSelf:       inst.id === myId,
            aliveLabel:   alive ? 'alive' : 'stale',
            aliveClass:   alive ? 'text-tertiary text-[12px]' : 'text-error text-[12px]',
            dotClass:     alive ? 'bg-tertiary w-2 h-2 rounded-full shrink-0' : 'bg-error w-2 h-2 rounded-full shrink-0',
            lastSeenText: seenSecs ? relativeTime(seenSecs) : '',
          };
        });
        self.engineInstances.splice(0, self.engineInstances.length, ...mapped);
        self.engineInstancesCount = self.engineInstances.length;
        self.noEngineInstances    = self.engineInstances.length === 0;
      } catch {
        self.engineInstancesCount = 0;
        self.noEngineInstances = true;
      }
    },

    async loadProxyConfig() {
      try {
        const cfg    = await api.getProxyConfig();
        const nodes  = cfg?.btcNodes ?? [];
        self.hasRegtest = nodes.some(n => n.url);
      } catch {
        self.hasRegtest = true; // assume regtest if config unavailable
      }
    },

    async init() {
      self.loading = true;
      self.error   = '';
      try {
        await Promise.all([
          self.loadProxyConfig(),
          self.loadChainNodes(),
          self.loadEngineInstances(),
        ]);
      } catch (err) {
        self.error = String(err);
      } finally {
        self.loading = false;  // always unblock UI even on uncaught error
      }
    },
  };

  return self;
}

export const NodeListView = {
  mount(el, _params, { api, router }) {
    el.innerHTML = template;
    const scope   = createController({ api, router });
    const binding = rivets.bind(el, scope);
    // .catch() ensures uncaught rejections don't silently leave loading=true
    scope.init().catch(err => {
      console.error('NodeListView init failed:', err);
      scope.loading = false;
      scope.error = String(err);
    });
    return { unbind() { binding.unbind(); } };
  },
};
