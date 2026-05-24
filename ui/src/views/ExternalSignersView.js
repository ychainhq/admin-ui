import rivets from '../rivets.js';
import { template as topBarTpl, createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl, createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl, createSidebarController } from '../components/DesktopSidebar.js';
import { template as mobileDrawerTpl, createMobileDrawerController } from '../components/MobileDrawer.js';
import { desktopTopBarHtml } from '../components/DesktopTopBar.js';
import { createActiveTenantController } from '../components/ActiveTenantBadge.js';
import { getActiveTenantKey } from '../api.js';

const ROUTE = '/external-signers';
const STALE_MINUTES = 5;

function fmtDate(v) {
  if (!v) return '—';
  try { return new Date(v).toISOString().slice(0, 16).replace('T', ' '); } catch { return '—'; }
}

function signerHealth(signer) {
  if (signer.status === 'disabled') return 'disabled';
  const hb = signer.last_heartbeat_at || signer.lastHeartbeatAt;
  if (!hb) return 'stale';
  const diffMs = Date.now() - new Date(hb).getTime();
  return diffMs > STALE_MINUTES * 60 * 1000 ? 'stale' : 'healthy';
}

const HEALTH_BADGE = {
  healthy:  'inline-flex items-center gap-xs px-2 py-0.5 rounded-full text-[11px] font-bold bg-tertiary/10 text-tertiary border border-tertiary/20',
  stale:    'inline-flex items-center gap-xs px-2 py-0.5 rounded-full text-[11px] font-bold bg-secondary/10 text-secondary border border-secondary/20',
  disabled: 'inline-flex items-center gap-xs px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/5 text-on-surface-variant border border-white/10',
};

function normalizeSigner(s) {
  const health = signerHealth(s);
  const fp = s.fingerprint || s.public_key_fingerprint || '';
  const chains = (s.supported_chains || s.supportedChains || []).join(', ') || '—';
  return {
    id:               s.id || '—',
    name:             s.name || '—',
    fingerprint:      fp,
    fpShort:          fp.length > 16 ? fp.slice(0, 8) + '…' + fp.slice(-6) : (fp || '—'),
    health,
    healthLabel:      health.toUpperCase(),
    healthBadgeClass: HEALTH_BADGE[health],
    healthDot:        health === 'healthy' ? 'w-1.5 h-1.5 rounded-full bg-tertiary shrink-0'
                    : health === 'stale'   ? 'w-1.5 h-1.5 rounded-full bg-secondary shrink-0'
                    :                        'w-1.5 h-1.5 rounded-full bg-white/20 shrink-0',
    lastHeartbeat:    fmtDate(s.last_heartbeat_at || s.lastHeartbeatAt),
    chains,
  };
}

const desktopTopBarTpl = desktopTopBarHtml({
  breadcrumbHtml: `
    <span class="text-on-surface-variant">Platform</span>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <span class="text-on-surface font-semibold">External Signers</span>
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

        <div rv-show="noActiveTenant" class="glass-card rounded-xl p-md bg-error/10 border border-error/30 flex items-start gap-sm">
          <span class="material-symbols-outlined text-error shrink-0 mt-xs">hub</span>
          <div>
            <p class="font-body-md text-error font-semibold">No active tenant</p>
            <p class="font-body-sm text-on-surface-variant mt-xs">
              Go to <a rv-on-click="goToTenants" href="#" class="text-secondary underline">Tenants</a> and click <strong>Work with</strong> first.
            </p>
          </div>
        </div>

        <div rv-hide="noActiveTenant">

          <div rv-show="error" class="glass-card rounded-xl p-md bg-error/10 border border-error/30 mb-md">
            <div class="flex items-center gap-sm">
              <span class="material-symbols-outlined text-error">error</span>
              <span rv-text="error" class="font-body-sm text-error"></span>
            </div>
          </div>

          <div rv-show="loading" class="flex justify-center py-lg">
            <div class="w-8 h-8 rounded-full border-2 border-secondary border-t-transparent animate-spin"></div>
          </div>

          <div rv-hide="loading" class="glass-card rounded-xl overflow-hidden">
            <div class="px-md py-sm bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
              <div class="flex items-center gap-sm">
                <span class="material-symbols-outlined text-on-surface-variant text-[18px]">verified_user</span>
                <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">External Signers</span>
              </div>
              <button rv-on-click="load" class="flex items-center gap-xs px-sm py-1 rounded-lg border border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all text-[12px]">
                <span class="material-symbols-outlined text-[14px]">refresh</span>
                Refresh
              </button>
            </div>

            <div rv-show="signersEmpty" class="p-lg text-center">
              <span class="material-symbols-outlined text-[48px] text-on-surface-variant">verified_user</span>
              <p class="font-body-md text-on-surface-variant mt-sm">No external signers enrolled</p>
              <p class="font-body-sm text-on-surface-variant mt-xs">Start the signer daemon — it self-enrolls on first run</p>
            </div>

            <!-- Desktop table -->
            <div rv-hide="signersEmpty" class="hidden lg:block overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="border-b border-white/5 bg-white/[0.02]">
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">NAME</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">FINGERPRINT</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">HEALTH</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">LAST HEARTBEAT</th>
                    <th class="px-md py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">CHAINS</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  <tr rv-each-signer="signers" class="hover:bg-white/[0.02]">
                    <td rv-text="signer.name"          class="px-md py-3 font-body-md text-on-surface font-semibold"></td>
                    <td class="px-md py-3">
                      <span rv-text="signer.fpShort" rv-attr-title="signer.fingerprint" class="font-mono-data text-on-surface-variant text-[12px] cursor-help"></span>
                    </td>
                    <td class="px-md py-3">
                      <span rv-attr-class="signer.healthBadgeClass" class="flex items-center gap-xs w-fit">
                        <span rv-attr-class="signer.healthDot"></span>
                        <span rv-text="signer.healthLabel"></span>
                      </span>
                    </td>
                    <td rv-text="signer.lastHeartbeat" class="px-md py-3 font-mono-data text-on-surface-variant text-[12px]"></td>
                    <td rv-text="signer.chains"        class="px-md py-3 font-body-sm text-on-surface-variant"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Mobile cards -->
            <div rv-hide="signersEmpty" class="lg:hidden divide-y divide-white/5">
              <div rv-each-signer="signers" class="px-md py-3">
                <div class="flex items-start justify-between mb-xs">
                  <p rv-text="signer.name" class="font-body-md text-on-surface font-semibold"></p>
                  <span rv-attr-class="signer.healthBadgeClass" class="flex items-center gap-xs">
                    <span rv-attr-class="signer.healthDot"></span>
                    <span rv-text="signer.healthLabel"></span>
                  </span>
                </div>
                <p class="font-mono-data text-on-surface-variant text-[11px]"><span rv-text="signer.fpShort"></span></p>
                <p class="font-body-sm text-on-surface-variant text-[11px] mt-xs">Chains: <span rv-text="signer.chains"></span></p>
                <p class="font-mono-data text-on-surface-variant text-[11px] mt-xs">Last HB: <span rv-text="signer.lastHeartbeat"></span></p>
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

export function createController({ api, router }) {
  const self = {
    mobileDrawer: createMobileDrawerController(),
    activeTenant: createActiveTenantController(),
    topBar: createTopBarController({
      title: 'External Signers',
      breadcrumb: 'External Signers',
      onBack: () => router.navigate('#/tenants'),
      onMenuOpen: () => self.mobileDrawer.open(),
    }),
    sidebar: createSidebarController({ activeRoute: ROUTE, router }),
    bottomNav: createBottomNavController({ activeRoute: ROUTE, router }),

    noActiveTenant: !getActiveTenantKey(),
    loading: false,
    error: null,
    signers: [],
    signersEmpty: true,

    goToTenants(e) { e?.preventDefault(); router.navigate('#/tenants'); },

    async load() {
      self.loading = true;
      self.error = null;
      try {
        const res = await api.getExternalSigners();
        const items = res.data || res || [];
        self.signers = (Array.isArray(items) ? items : []).map(normalizeSigner);
        self.signersEmpty = self.signers.length === 0;
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

export const ExternalSignersView = {
  mount(el, params, { api, router }) {
    el.innerHTML = template;
    const scope = createController({ api, router });
    const binding = rivets.bind(el, scope);
    scope.init();
    return { unbind() { binding.unbind(); } };
  },
};
