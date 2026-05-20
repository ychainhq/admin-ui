import rivets from '../rivets.js';
import { template as topBarTpl } from '../components/TopAppBar.js';
import { createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl } from '../components/BottomNav.js';
import { createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl } from '../components/DesktopSidebar.js';
import { createSidebarController } from '../components/DesktopSidebar.js';

const ROUTE = '/tenants';

const template = `
<div class="min-h-screen">

  ${sidebarTpl}

  <div class="lg:ml-[280px]">

    ${topBarTpl}

    <!-- Desktop top bar -->
    <div class="hidden lg:flex fixed top-0 left-[280px] right-0 z-40 bg-surface-dim/80 backdrop-blur-xl border-b border-white/10 items-center justify-between px-margin-desktop h-16">
      <div class="flex flex-col">
        <span class="font-label-md text-[10px] uppercase tracking-wider text-on-surface-variant">Platform &gt; Tenants &gt; New</span>
      </div>
      <div class="flex items-center gap-sm">
        <button rv-on-click="cancel" class="border border-white/20 text-on-surface px-md py-sm rounded-lg font-headline-sm text-[14px] font-bold active:scale-95 transition-all hover:bg-white/5">Cancel</button>
        <button rv-on-click="submit" rv-attr-disabled="submitting" class="bg-secondary text-on-secondary-fixed px-md py-sm rounded-lg font-headline-sm text-[14px] font-bold active:scale-95 transition-all hover:brightness-110 disabled:opacity-50">
          <span rv-hide="submitting">Create Tenant</span>
          <span rv-show="submitting">Creating…</span>
        </button>
      </div>
    </div>

    <main class="pt-20 lg:pt-16 pb-28 lg:pb-8 px-margin-mobile lg:px-margin-desktop">
      <div class="max-w-xl mx-auto">

        <div class="pt-gutter mb-gutter">
          <h1 class="font-headline-md text-headline-md text-on-surface">Create Tenant</h1>
          <p class="font-body-sm text-on-surface-variant mt-xs">Register a new tenant environment on this node.</p>
        </div>

        <!-- Error -->
        <div rv-show="error" class="glass-card rounded-xl p-md bg-error/10 border border-error/30 mb-gutter">
          <div class="flex items-center gap-sm">
            <span class="material-symbols-outlined text-error">error</span>
            <span rv-text="error" class="font-body-sm text-error"></span>
          </div>
        </div>

        <div class="glass-card rounded-xl p-md space-y-md">
          <!-- Tenant Name -->
          <div>
            <label class="block font-label-md text-on-surface-variant text-[10px] uppercase mb-xs">Display Name</label>
            <input rv-on-input="onNameInput"
              class="w-full bg-surface-container-low border border-white/10 rounded-lg px-4 py-3 text-on-surface font-body-md focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none"
              type="text" placeholder="e.g. My Organisation" autocomplete="off" />
          </div>
          <!-- BTC Hot Wallet Address -->
          <div>
            <label class="block font-label-md text-on-surface-variant text-[10px] uppercase mb-xs">BTC Hot Address</label>
            <input rv-on-input="onHotAddressInput"
              class="w-full bg-surface-container-low border border-white/10 rounded-lg px-4 py-3 text-on-surface font-mono-data focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none"
              type="text" placeholder="bc1q... or tb1q..." autocomplete="off" />
            <p class="font-body-sm text-on-surface-variant mt-xs">Bitcoin address for the tenant hot wallet (receives sweeps).</p>
          </div>

          <!-- Mobile actions -->
          <div class="lg:hidden flex gap-sm pt-sm">
            <button rv-on-click="cancel" class="flex-1 border border-white/20 text-on-surface px-md py-sm rounded-lg font-headline-sm text-[14px] font-bold active:scale-95 transition-all">Cancel</button>
            <button rv-on-click="submit" rv-attr-disabled="submitting" class="flex-1 bg-secondary text-on-secondary-fixed px-md py-sm rounded-lg font-headline-sm text-[14px] font-bold active:scale-95 transition-all disabled:opacity-50">
              <span rv-hide="submitting">Create</span>
              <span rv-show="submitting">Creating…</span>
            </button>
          </div>
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
      title: 'New Tenant',
      breadcrumb: 'Platform > Tenants > New',
      onBack: () => router.navigate('#/tenants'),
    }),
    sidebar: createSidebarController({ activeRoute: ROUTE, router }),
    bottomNav: createBottomNavController({ activeRoute: ROUTE, router }),

    submitting: false,
    error: null,

    _form: {
      name: '',
      hotAddress: '',
    },

    onNameInput(e) {
      self._form.name = e.target.value.trim();
    },
    onHotAddressInput(e) {
      self._form.hotAddress = e.target.value.trim();
    },

    validate() {
      if (!self._form.name) return 'Display name is required.';
      if (!self._form.hotAddress) return 'BTC hot address is required.';
      return null;
    },

    async submit() {
      const err = self.validate();
      if (err) { self.error = err; return; }
      self.submitting = true;
      self.error = null;
      try {
        await api.createTenant({
          name: self._form.name,
          assets: [{ chain: 'bitcoin', hotAddress: self._form.hotAddress }],
        });
        router.navigate('#/tenants');
      } catch (e) {
        self.error = e.message;
      } finally {
        self.submitting = false;
      }
    },

    cancel() {
      router.navigate('#/tenants');
    },
  };
  return self;
}

export const TenantCreateView = {
  mount(el, _params, { api, router }) {
    el.innerHTML = template;
    const scope = createController({ api, router });
    const binding = rivets.bind(el, scope);
    return {
      unbind() {
        binding.unbind();
      },
    };
  },
};
