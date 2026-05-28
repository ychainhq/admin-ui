import rivets from '../rivets.js';
import { template as topBarTpl, createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl, createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl, createSidebarController } from '../components/DesktopSidebar.js';
import { template as mobileDrawerTpl, createMobileDrawerController } from '../components/MobileDrawer.js';
import { desktopTopBarHtml } from '../components/DesktopTopBar.js';
import { createActiveTenantController } from '../components/ActiveTenantBadge.js';
import { getActiveTenantKey } from '../api.js';

const ROUTE = '/external-signer-policies';

function fmtDate(v) {
  if (!v) return '—';
  try { return new Date(v).toISOString().slice(0, 16).replace('T', ' '); } catch { return '—'; }
}

function fmtSat(v) {
  if (!v) return '—';
  try { return BigInt(v).toLocaleString() + ' sat'; } catch { return v; }
}

function scopeLabel(p) {
  if (!p.signer_id && !p.chain_id && !p.asset_id) return 'Tenant default';
  const parts = [];
  if (p.signer_id) parts.push(`signer:${p.signer_id.slice(0, 10)}…`);
  if (p.chain_id)  parts.push(p.chain_id);
  if (p.asset_id)  parts.push(p.asset_id);
  return parts.join(' / ');
}

function normalizePolicy(p) {
  return {
    id:                p.id,
    scope:             scopeLabel(p),
    isTenantDefault:   !p.signer_id && !p.chain_id && !p.asset_id,
    isSignerLevel:     !!p.signer_id,
    autoSignLimit:     fmtSat(p.auto_sign_limit_raw),
    manualApprovalFrom: fmtSat(p.manual_approval_from_raw),
    dailyAutoSignLimit: fmtSat(p.daily_auto_sign_limit_raw),
    maxSigsPerHour:    p.max_signatures_per_hour != null ? String(p.max_signatures_per_hour) : '—',
    maxFeeRate:        p.max_fee_rate_sat_vb != null ? p.max_fee_rate_sat_vb + ' sat/vB' : '—',
    maxOutputs:        p.max_outputs_per_batch != null ? String(p.max_outputs_per_batch) : '—',
    isEnabled:         p.is_enabled === 1 || p.is_enabled === true,
    createdAt:         fmtDate(p.created_at),
  };
}

const desktopTopBarTpl = desktopTopBarHtml({
  breadcrumbHtml: `
    <span class="text-on-surface-variant">Operations</span>
    <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
    <span class="text-on-surface font-semibold">Signer Policies</span>
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
      <div class="mx-auto pt-gutter space-y-md">

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

          <!-- Error banner -->
          <div rv-show="error" class="glass-card rounded-xl p-md bg-error/10 border border-error/30 mb-md">
            <div class="flex items-center gap-sm">
              <span class="material-symbols-outlined text-error">error</span>
              <span rv-text="error" class="font-body-sm text-error"></span>
            </div>
          </div>

          <!-- Success banner -->
          <div rv-show="saveSuccess" class="glass-card rounded-xl p-md bg-tertiary/10 border border-tertiary/30 mb-md">
            <div class="flex items-center gap-sm">
              <span class="material-symbols-outlined text-tertiary">check_circle</span>
              <span class="font-body-sm text-tertiary">Policy saved successfully.</span>
            </div>
          </div>

          <!-- ── Default Policy Form ── -->
          <div class="glass-card rounded-xl overflow-hidden">
            <div class="px-md py-sm bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
              <div class="flex items-center gap-sm">
                <span class="material-symbols-outlined text-on-surface-variant text-[18px]">tune</span>
                <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">Tenant Default Policy</span>
              </div>
              <div rv-show="loading" class="w-4 h-4 rounded-full border-2 border-secondary border-t-transparent animate-spin"></div>
            </div>

            <div class="p-md">
              <p class="font-body-sm text-on-surface-variant mb-md text-[12px]">
                Applies to all signing tasks unless a more specific signer/chain/asset policy exists.
                Limits are in satoshis. Leave blank to disable a limit.
              </p>

              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">

                <div>
                  <label class="block font-label-md text-on-surface-variant text-[11px] uppercase tracking-wider mb-xs">Auto-sign limit (sat)</label>
                  <input rv-value="formAutoSignLimit" type="text" inputmode="numeric" placeholder="e.g. 100000"
                    class="w-full bg-white/5 border border-white/10 rounded-lg px-sm py-2 text-[13px] font-mono-data text-on-surface focus:outline-none focus:border-secondary placeholder:text-on-surface-variant/40">
                  <p class="font-body-sm text-on-surface-variant text-[11px] mt-xs">Tasks ≤ this are signed automatically</p>
                </div>

                <div>
                  <label class="block font-label-md text-on-surface-variant text-[11px] uppercase tracking-wider mb-xs">Manual approval from (sat)</label>
                  <input rv-value="formManualApprovalFrom" type="text" inputmode="numeric" placeholder="e.g. 500000"
                    class="w-full bg-white/5 border border-white/10 rounded-lg px-sm py-2 text-[13px] font-mono-data text-on-surface focus:outline-none focus:border-secondary placeholder:text-on-surface-variant/40">
                  <p class="font-body-sm text-on-surface-variant text-[11px] mt-xs">Tasks ≥ this require operator approval</p>
                </div>

                <div>
                  <label class="block font-label-md text-on-surface-variant text-[11px] uppercase tracking-wider mb-xs">Daily auto-sign limit (sat)</label>
                  <input rv-value="formDailyAutoSignLimit" type="text" inputmode="numeric" placeholder="e.g. 10000000"
                    class="w-full bg-white/5 border border-white/10 rounded-lg px-sm py-2 text-[13px] font-mono-data text-on-surface focus:outline-none focus:border-secondary placeholder:text-on-surface-variant/40">
                  <p class="font-body-sm text-on-surface-variant text-[11px] mt-xs">Daily cumulative cap for auto-signing</p>
                </div>

                <div>
                  <label class="block font-label-md text-on-surface-variant text-[11px] uppercase tracking-wider mb-xs">Max signatures / hour</label>
                  <input rv-value="formMaxSigsPerHour" type="number" min="1" placeholder="e.g. 10"
                    class="w-full bg-white/5 border border-white/10 rounded-lg px-sm py-2 text-[13px] font-mono-data text-on-surface focus:outline-none focus:border-secondary placeholder:text-on-surface-variant/40">
                </div>

                <div>
                  <label class="block font-label-md text-on-surface-variant text-[11px] uppercase tracking-wider mb-xs">Max fee rate (sat/vB)</label>
                  <input rv-value="formMaxFeeRate" type="number" min="1" placeholder="e.g. 50"
                    class="w-full bg-white/5 border border-white/10 rounded-lg px-sm py-2 text-[13px] font-mono-data text-on-surface focus:outline-none focus:border-secondary placeholder:text-on-surface-variant/40">
                  <p class="font-body-sm text-on-surface-variant text-[11px] mt-xs">Signer will reject if fee rate exceeds this</p>
                </div>

                <div>
                  <label class="block font-label-md text-on-surface-variant text-[11px] uppercase tracking-wider mb-xs">Max outputs per batch</label>
                  <input rv-value="formMaxOutputs" type="number" min="1" placeholder="e.g. 50"
                    class="w-full bg-white/5 border border-white/10 rounded-lg px-sm py-2 text-[13px] font-mono-data text-on-surface focus:outline-none focus:border-secondary placeholder:text-on-surface-variant/40">
                </div>

              </div>

              <div class="flex items-center gap-sm mt-md pt-md border-t border-white/5">
                <button rv-on-click="save" class="flex items-center gap-xs px-md py-2 rounded-lg bg-secondary text-on-secondary-fixed font-bold text-[13px] hover:brightness-110 active:scale-95 transition-all">
                  <span class="material-symbols-outlined text-[16px]">save</span>
                  Save policy
                </button>
                <button rv-on-click="load" class="flex items-center gap-xs px-sm py-2 rounded-lg border border-white/10 text-on-surface-variant hover:text-on-surface hover:bg-white/5 transition-all text-[12px]">
                  <span class="material-symbols-outlined text-[14px]">refresh</span>
                  Reload
                </button>
                <p class="font-body-sm text-on-surface-variant text-[11px] ml-auto">
                  Each save adds a new policy entry. The engine uses the first matching policy (by creation order).
                </p>
              </div>
            </div>
          </div>

          <!-- ── All Policies Table ── -->
          <div class="glass-card rounded-xl overflow-hidden">
            <div class="px-md py-sm bg-white/[0.03] border-b border-white/5 flex items-center gap-sm">
              <span class="material-symbols-outlined text-on-surface-variant text-[18px]">list_alt</span>
              <span class="font-label-md text-on-surface-variant uppercase tracking-wider text-[10px]">Configured Policies</span>
              <span rv-text="policiesCount" class="ml-auto font-mono-data text-on-surface-variant text-[11px]"></span>
            </div>

            <div rv-show="policiesEmpty" class="p-lg text-center">
              <span class="material-symbols-outlined text-[48px] text-on-surface-variant">tune</span>
              <p class="font-body-md text-on-surface-variant mt-sm">No policies configured</p>
              <p class="font-body-sm text-on-surface-variant mt-xs">Use the form above to set the default tenant policy</p>
            </div>

            <div rv-hide="policiesEmpty" class="overflow-x-auto">
              <table class="w-full text-left border-collapse" style="min-width:860px">
                <thead>
                  <tr class="border-b border-white/5 bg-white/[0.02]">
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">SCOPE</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">AUTO-SIGN ≤</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">MANUAL FROM ≥</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">DAILY CAP</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">MAX RATE</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">MAX OUT</th>
                    <th class="px-sm py-3 text-[10px] font-label-md text-on-surface-variant uppercase tracking-wider">CREATED</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  <tr rv-each-policy="policies" class="hover:bg-white/[0.02]">
                    <td class="px-sm py-3">
                      <span rv-text="policy.scope" class="font-body-sm text-on-surface text-[12px] font-semibold"></span>
                      <span rv-show="policy.isTenantDefault" class="ml-xs inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-secondary/10 text-secondary border border-secondary/20">DEFAULT</span>
                    </td>
                    <td rv-text="policy.autoSignLimit"     class="px-sm py-3 font-mono-data text-on-surface-variant text-[12px]"></td>
                    <td rv-text="policy.manualApprovalFrom" class="px-sm py-3 font-mono-data text-on-surface-variant text-[12px]"></td>
                    <td rv-text="policy.dailyAutoSignLimit" class="px-sm py-3 font-mono-data text-on-surface-variant text-[12px]"></td>
                    <td rv-text="policy.maxFeeRate"         class="px-sm py-3 font-mono-data text-on-surface-variant text-[12px]"></td>
                    <td rv-text="policy.maxOutputs"         class="px-sm py-3 font-mono-data text-on-surface-variant text-[12px]"></td>
                    <td rv-text="policy.createdAt"          class="px-sm py-3 font-mono-data text-on-surface-variant text-[12px] whitespace-nowrap"></td>
                  </tr>
                </tbody>
              </table>
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
      title: 'Signer Policies',
      breadcrumb: 'Signer Policies',
      onBack: () => router.navigate('#/external-signers'),
      onMenuOpen: () => self.mobileDrawer.open(),
    }),
    sidebar: createSidebarController({ activeRoute: ROUTE, router }),
    bottomNav: createBottomNavController({ activeRoute: ROUTE, router }),

    noActiveTenant: !getActiveTenantKey(),
    loading: false,
    error: null,
    saveSuccess: false,
    policies: [],
    policiesEmpty: true,
    policiesCount: '0 entries',

    // Form fields — flat properties for Rivets reactivity
    formAutoSignLimit: '',
    formManualApprovalFrom: '',
    formDailyAutoSignLimit: '',
    formMaxSigsPerHour: '',
    formMaxFeeRate: '',
    formMaxOutputs: '',

    goToTenants(e) { e?.preventDefault(); router.navigate('#/tenants'); },

    async load() {
      self.loading = true;
      self.error = null;
      self.saveSuccess = false;
      try {
        const items = await api.getSignerPolicies();
        self.policies = (Array.isArray(items) ? items : []).map(normalizePolicy);
        self.policiesEmpty = self.policies.length === 0;
        self.policiesCount = `${self.policies.length} entr${self.policies.length === 1 ? 'y' : 'ies'}`;

        // Pre-fill form from effective tenant-level default (first match = oldest)
        const tenantDefault = (Array.isArray(items) ? items : []).find(
          p => !p.signer_id && !p.chain_id && !p.asset_id
        );
        if (tenantDefault) {
          self.formAutoSignLimit    = tenantDefault.auto_sign_limit_raw    || '';
          self.formManualApprovalFrom = tenantDefault.manual_approval_from_raw || '';
          self.formDailyAutoSignLimit = tenantDefault.daily_auto_sign_limit_raw || '';
          self.formMaxSigsPerHour   = tenantDefault.max_signatures_per_hour != null ? String(tenantDefault.max_signatures_per_hour) : '';
          self.formMaxFeeRate       = tenantDefault.max_fee_rate_sat_vb    != null ? String(tenantDefault.max_fee_rate_sat_vb)    : '';
          self.formMaxOutputs       = tenantDefault.max_outputs_per_batch  != null ? String(tenantDefault.max_outputs_per_batch)  : '';
        }
      } catch (e) {
        self.error = e.message;
      } finally {
        self.loading = false;
      }
    },

    async save(e) {
      e?.preventDefault();
      self.error = null;
      self.saveSuccess = false;
      self.loading = true;
      try {
        const policy = {};
        if (self.formAutoSignLimit.trim())     policy.autoSignLimitRaw      = self.formAutoSignLimit.trim();
        if (self.formManualApprovalFrom.trim()) policy.manualApprovalFromRaw = self.formManualApprovalFrom.trim();
        if (self.formDailyAutoSignLimit.trim()) policy.dailyAutoSignLimitRaw = self.formDailyAutoSignLimit.trim();
        if (self.formMaxSigsPerHour.trim())    policy.maxSignaturesPerHour  = parseInt(self.formMaxSigsPerHour, 10);
        if (self.formMaxFeeRate.trim())         policy.maxFeeRateSatVb       = parseInt(self.formMaxFeeRate, 10);
        if (self.formMaxOutputs.trim())         policy.maxOutputsPerBatch    = parseInt(self.formMaxOutputs, 10);

        await api.saveSignerPolicies([policy]);
        self.saveSuccess = true;
        await self.load();
      } catch (err) {
        self.error = err.message;
        self.loading = false;
      }
    },

    init() {
      if (!self.noActiveTenant) self.load();
    },
  };
  return self;
}

export const SignerPoliciesView = {
  mount(el, params, { api, router }) {
    el.innerHTML = template;
    const scope = createController({ api, router });
    const binding = rivets.bind(el, scope);
    scope.init();
    return { unbind() { binding.unbind(); } };
  },
};
