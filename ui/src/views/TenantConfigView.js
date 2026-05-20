import rivets from '../rivets.js';
import { template as topBarTpl } from '../components/TopAppBar.js';
import { createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl } from '../components/BottomNav.js';
import { createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl } from '../components/DesktopSidebar.js';
import { createSidebarController } from '../components/DesktopSidebar.js';
import { template as configFieldTpl } from '../components/ConfigField.js';
import { createConfigFieldsController, collectConfigValues } from '../components/ConfigField.js';

const ROUTE = '/tenants';

const template = `
<div class="min-h-screen">

  ${sidebarTpl}

  <div class="lg:ml-[280px]">

    ${topBarTpl}

    <!-- Desktop top bar — breadcrumbs only -->
    <div class="hidden lg:flex fixed top-0 left-[280px] right-0 z-40 bg-surface-container-low/50 backdrop-blur-xl border-b border-white/10 items-center px-margin-desktop h-16">
      <nav class="flex items-center gap-2 text-label-md font-label-md">
        <span class="text-on-surface-variant">Platform</span>
        <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
        <span class="text-on-surface-variant">Tenants</span>
        <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
        <span rv-text="tenantId" class="text-on-surface-variant font-mono"></span>
        <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
        <span class="text-on-surface font-semibold">Config</span>
      </nav>
    </div>

    <!-- Main content -->
    <main class="pt-20 lg:pt-16 pb-28 lg:pb-8 px-margin-mobile lg:px-margin-desktop">
      <div class="max-w-3xl mx-auto lg:max-w-none">

        <!-- Page heading -->
        <div class="pt-gutter mb-gutter">
          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-md">
            <div>
              <h1 class="font-headline-md text-headline-md text-on-surface">Tenant Configuration</h1>
              <p class="font-body-sm text-on-surface-variant mt-xs">Configure security protocols and transactional constraints for this environment.</p>
            </div>
            <!-- Save/cancel buttons (both mobile and desktop) -->
            <div class="flex gap-sm shrink-0">
              <button rv-on-click="cancelConfig" class="border border-white/20 text-on-surface px-4 py-2 rounded-lg font-label-md font-bold active:scale-95 transition-all hover:bg-white/5">Cancel</button>
              <button rv-on-click="saveConfig" rv-attr-disabled="saving" class="bg-secondary text-on-secondary-fixed px-4 py-2 rounded-lg font-label-md font-bold active:scale-95 transition-all hover:brightness-110 disabled:opacity-50">
                <span rv-hide="saving">Save Configuration</span>
                <span rv-show="saving">Saving…</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Loading state -->
        <div rv-show="loading" class="flex justify-center py-lg">
          <div class="w-8 h-8 rounded-full border-2 border-secondary border-t-transparent animate-spin"></div>
        </div>

        <!-- Error state -->
        <div rv-show="error" class="glass-card rounded-xl p-md bg-error/10 border border-error/30 mb-gutter">
          <div class="flex items-center gap-sm">
            <span class="material-symbols-outlined text-error">error</span>
            <span rv-text="error" class="font-body-sm text-error"></span>
          </div>
        </div>

        <!-- Success state -->
        <div rv-show="saveSuccess" class="glass-card rounded-xl p-md bg-tertiary/10 border border-tertiary/30 mb-gutter">
          <div class="flex items-center gap-sm">
            <span class="material-symbols-outlined text-tertiary">check_circle</span>
            <span class="font-body-sm text-tertiary">Configuration saved successfully.</span>
          </div>
        </div>

        <!-- Config fields form -->
        <div rv-hide="loading" class="glass-card rounded-xl overflow-hidden">
          ${configFieldTpl}
        </div>

        <!-- Info cards -->
        <div rv-hide="loading" class="grid grid-cols-1 lg:grid-cols-3 gap-gutter mt-gutter">
          <div class="glass-card rounded-xl p-md flex items-start gap-sm">
            <div class="bg-secondary/10 p-2 rounded-lg shrink-0">
              <span class="material-symbols-outlined text-secondary">verified_user</span>
            </div>
            <div>
              <p class="font-label-md text-on-surface font-bold text-[12px] mb-xs">Security Audit</p>
              <p class="font-body-sm text-on-surface-variant">Changes are logged and require an administrator signature to take effect.</p>
            </div>
          </div>
          <div class="glass-card rounded-xl p-md flex items-start gap-sm">
            <div class="bg-secondary/10 p-2 rounded-lg shrink-0">
              <span class="material-symbols-outlined text-secondary">source_environment</span>
            </div>
            <div>
              <p class="font-label-md text-on-surface font-bold text-[12px] mb-xs">Version Control</p>
              <p rv-text="versionLabel" class="font-body-sm text-on-surface-variant"></p>
            </div>
          </div>
          <div class="glass-card rounded-xl p-md flex items-start gap-sm">
            <div class="bg-tertiary/10 p-2 rounded-lg shrink-0">
              <span class="material-symbols-outlined text-tertiary">bolt</span>
            </div>
            <div>
              <p class="font-label-md text-on-surface font-bold text-[12px] mb-xs">Live Propagation</p>
              <p class="font-body-sm text-on-surface-variant">Changes to BTC parameters propagate to the engine within 60 seconds.</p>
            </div>
          </div>
        </div>

      </div>
    </main>

    ${bottomNavTpl}

  </div>

</div>
`;

// snake_case → camelCase mapping for PATCH request (engine Zod schema expects camelCase)
const SNAKE_TO_CAMEL = {
  btc_confirmations_required:  'btcConfirmationsRequired',
  btc_finality_confirmations:  'btcFinalityConfirmations',
  custody_mode:                'custodyMode',
  withdrawal_mode:             'withdrawalMode',
  daily_withdrawal_limit_sats: 'dailyWithdrawalLimitSats',
  per_tx_limit_sats:           'perTxLimitSats',
  btc_xpub:                    'btcXpub',
  btc_sweep_threshold_sats:    'btcSweepThresholdSats',
  customer_session_ttl_seconds: 'customerSessionTtlSeconds',
};

export function createController({ tenantId, api, router }) {
  const self = {
    tenantId,
    topBar: createTopBarController({
      title: 'Tenant Config',
      breadcrumb: `Platform > Tenants > ${tenantId}`,
      onBack: () => router.navigate('#/tenants'),
    }),
    sidebar: createSidebarController({ activeRoute: ROUTE, router }),
    bottomNav: createBottomNavController({ activeRoute: ROUTE, router }),

    config: { fields: [] },
    loading: false,
    saving: false,
    error: null,
    saveSuccess: false,
    versionLabel: 'Loading…',

    _rawConfig: {},

    _onFieldChange(key, value) {
      self._rawConfig[key] = value;
      const field = self.config.fields.find(f => f.key === key);
      if (field) field.displayValue = value;
    },

    async load() {
      self.loading = true;
      self.error = null;
      try {
        const data = await api.getTenantConfig(tenantId);
        self._rawConfig = { ...data };
        self.config = {
          fields: createConfigFieldsController(data, (k, v) => self._onFieldChange(k, v)),
        };
        self.versionLabel = data.updated_at
          ? `Last updated on ${new Date(data.updated_at * 1000).toLocaleString()}.`
          : 'Not yet modified.';
      } catch (e) {
        self.error = e.message;
      } finally {
        self.loading = false;
      }
    },

    async saveConfig() {
      self.saving = true;
      self.error = null;
      self.saveSuccess = false;
      try {
        const snakePayload = collectConfigValues(self.config.fields);
        // Convert to camelCase — engine PATCH endpoint uses Zod camelCase schema
        const payload = {};
        Object.keys(snakePayload).forEach(k => {
          const camel = SNAKE_TO_CAMEL[k] || k;
          payload[camel] = snakePayload[k];
        });
        await api.saveTenantConfig(tenantId, payload);
        self.saveSuccess = true;
        setTimeout(() => { self.saveSuccess = false; }, 4000);
      } catch (e) {
        self.error = e.message;
      } finally {
        self.saving = false;
      }
    },

    cancelConfig() {
      router.navigate('#/tenants');
    },

    init() {
      self.load();
    },
  };
  return self;
}

export const TenantConfigView = {
  mount(el, { id }, { api, router }) {
    el.innerHTML = template;
    const scope = createController({ tenantId: id, api, router });
    const binding = rivets.bind(el, scope);
    scope.init();
    return {
      unbind() {
        binding.unbind();
      },
    };
  },
};
