import rivets from '../rivets.js';
import { template as topBarTpl, createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl, createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl, createSidebarController } from '../components/DesktopSidebar.js';
import { NODES } from '../nodes.js';

const ROUTE = '/nodes';

const nodeCardsTpl = `
<div rv-each-node="nodes" rv-on-click="node.open"
  class="glass-card rounded-xl p-md flex items-center gap-md cursor-pointer hover:bg-white/5 transition-all active:scale-[0.99]">
  <div class="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center border border-secondary/20 shrink-0">
    <span rv-text="node.chainIcon" class="material-symbols-outlined text-secondary text-[24px]"></span>
  </div>
  <div class="flex-1 min-w-0">
    <div class="flex items-center gap-sm mb-xs">
      <p rv-text="node.label" class="font-label-md text-on-surface font-bold"></p>
      <span rv-text="node.network" class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-on-surface-variant uppercase tracking-wider"></span>
    </div>
    <div class="flex items-center gap-md">
      <div class="flex items-center gap-xs">
        <span rv-show="node.checking" class="font-body-sm text-on-surface-variant text-[12px] italic">Checking…</span>
        <span rv-show="node.showOnline" class="w-2 h-2 rounded-full bg-tertiary shrink-0"></span>
        <span rv-show="node.showOnline" class="font-body-sm text-tertiary text-[12px]">Online</span>
        <span rv-show="node.showOffline" class="w-2 h-2 rounded-full bg-error shrink-0"></span>
        <span rv-show="node.showOffline" class="font-body-sm text-error text-[12px]">Offline</span>
      </div>
      <span rv-show="node.blocksText" class="font-body-sm text-on-surface-variant text-[12px]">
        Block <span rv-text="node.blocksText" class="font-mono text-on-surface text-[12px]"></span>
      </span>
    </div>
  </div>
  <span class="material-symbols-outlined text-on-surface-variant">chevron_right</span>
</div>
`;

const template = `
<div class="min-h-screen">

  ${sidebarTpl}

  <div class="lg:ml-[280px]">

    ${topBarTpl}

    <div class="hidden lg:flex fixed top-0 left-[280px] right-0 z-40 bg-surface-container-low/50 backdrop-blur-xl border-b border-white/10 items-center px-margin-desktop h-16">
      <nav class="flex items-center gap-2 text-label-md font-label-md">
        <span class="text-on-surface-variant">Dev</span>
        <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
        <span class="text-on-surface font-semibold">Nodes</span>
      </nav>
    </div>

    <main class="pt-20 lg:pt-16 pb-28 lg:pb-8 px-margin-mobile lg:px-margin-desktop">
      <div class="mx-auto">

        <div class="pt-gutter mb-gutter">
          <h2 class="text-display-lg font-display-lg text-on-surface mb-xs">Dev Nodes</h2>
          <p class="text-body-md font-body-md text-on-surface-variant">Blockchain nodes available for simulation and testing.</p>
        </div>

        <div class="max-w-2xl space-y-gutter">
          ${nodeCardsTpl}
        </div>

      </div>
    </main>

    ${bottomNavTpl}

  </div>

</div>
`;

export function createController({ api, router }) {
  const self = {
    topBar: createTopBarController({
      title: 'Dev Nodes',
      breadcrumb: 'Dev > Nodes',
      onBack: () => window.history.back(),
      onMenuOpen: () => {},
    }),
    sidebar: createSidebarController({ activeRoute: ROUTE, router }),
    bottomNav: createBottomNavController({ activeRoute: ROUTE, router }),
    nodes: [],

    async init() {
      const vms = NODES.map(n => ({
        id: n.id,
        label: n.label,
        chain: n.chain,
        network: n.network,
        chainIcon: n.chainIcon,
        online: false,
        checking: true,
        showOnline: false,
        showOffline: false,
        blocksText: '',
        open() { router.navigate(`#/nodes/${n.id}`); },
      }));
      self.nodes = [...vms];

      for (let i = 0; i < vms.length; i++) {
        if (vms[i].chain === 'BTC') {
          try {
            const res = await api.rpc('getblockchaininfo', []);
            const info = res?.result;
            vms[i] = { ...vms[i], checking: false, showOnline: !!info, showOffline: !info, online: !!info, blocksText: info?.blocks != null ? String(info.blocks) : '' };
          } catch {
            vms[i] = { ...vms[i], checking: false, showOnline: false, showOffline: true };
          }
          self.nodes = [...vms];
        }
      }
    },
  };
  return self;
}

export const NodeListView = {
  mount(el, _params, { api, router }) {
    el.innerHTML = template;
    const scope = createController({ api, router });
    const binding = rivets.bind(el, scope);
    scope.init();
    return { unbind() { binding.unbind(); } };
  },
};
