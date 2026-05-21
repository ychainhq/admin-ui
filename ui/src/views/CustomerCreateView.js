import rivets from '../rivets.js';
import { template as topBarTpl, createTopBarController } from '../components/TopAppBar.js';
import { template as bottomNavTpl, createBottomNavController } from '../components/BottomNav.js';
import { template as sidebarTpl, createSidebarController } from '../components/DesktopSidebar.js';

const ROUTE = '/customers';

const template = `
<div class="min-h-screen">

  ${sidebarTpl}

  <div class="lg:ml-[280px]">

    ${topBarTpl}

    <!-- Desktop top bar -->
    <div class="hidden lg:flex fixed top-0 left-[280px] right-0 z-40 bg-surface-dim/80 backdrop-blur-xl border-b border-white/10 items-center justify-between px-margin-desktop h-16">
      <div class="flex flex-col">
        <span class="font-label-md text-[10px] uppercase tracking-wider text-on-surface-variant">Platform &gt; Customers &gt; New</span>
      </div>
      <div class="flex items-center gap-sm">
        <button rv-on-click="cancel"
          class="border border-white/20 text-on-surface px-md py-sm rounded-lg font-headline-sm text-[14px] font-bold active:scale-95 transition-all hover:bg-white/5">
          Cancel
        </button>
        <button rv-on-click="submit" rv-attr-disabled="submitting"
          class="bg-secondary text-on-secondary-fixed px-md py-sm rounded-lg font-headline-sm text-[14px] font-bold active:scale-95 transition-all hover:brightness-110 disabled:opacity-50">
          <span rv-hide="submitting">Create Customer</span>
          <span rv-show="submitting">Creating…</span>
        </button>
      </div>
    </div>

    <main class="pt-20 lg:pt-16 pb-28 lg:pb-8 px-margin-mobile lg:px-margin-desktop">
      <div class="max-w-xl mx-auto">

        <div class="pt-gutter mb-gutter">
          <h1 class="font-headline-md text-headline-md text-on-surface">New Customer</h1>
          <p class="font-body-sm text-on-surface-variant mt-xs">Register a new customer for the active tenant.</p>
        </div>

        <!-- Error -->
        <div rv-show="error" class="glass-card rounded-xl p-md bg-error/10 border border-error/30 mb-gutter">
          <div class="flex items-center gap-sm">
            <span class="material-symbols-outlined text-error">error</span>
            <span rv-text="error" class="font-body-sm text-error"></span>
          </div>
        </div>

        <div class="glass-card rounded-xl p-md space-y-md">

          <!-- Reference -->
          <div>
            <label class="block font-label-md text-on-surface-variant text-[10px] uppercase mb-xs">
              Reference <span class="normal-case opacity-60">(optional)</span>
            </label>
            <input rv-on-input="onReferenceInput"
              class="w-full bg-surface-container-low border border-white/10 rounded-lg px-4 py-3 text-on-surface font-body-md focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none"
              type="text" placeholder="e.g. user-abc-123" autocomplete="off" />
            <p class="font-body-sm text-on-surface-variant mt-xs">External ID from your system. Must be unique per tenant.</p>
          </div>

          <!-- Metadata -->
          <div>
            <label class="block font-label-md text-on-surface-variant text-[10px] uppercase mb-xs">
              Metadata <span class="normal-case opacity-60">(optional JSON)</span>
            </label>
            <textarea rv-on-input="onMetadataInput"
              class="w-full bg-surface-container-low border border-white/10 rounded-lg px-4 py-3 text-on-surface font-mono-data focus:ring-1 focus:ring-secondary focus:border-secondary transition-all outline-none resize-none"
              rows="4" placeholder='{ "plan": "pro", "userId": 42 }'></textarea>
            <p rv-show="metadataError" rv-text="metadataError" class="font-body-sm text-error mt-xs"></p>
          </div>

          <!-- Mobile actions -->
          <div class="lg:hidden flex gap-sm pt-sm">
            <button rv-on-click="cancel"
              class="flex-1 border border-white/20 text-on-surface px-md py-sm rounded-lg font-headline-sm text-[14px] font-bold active:scale-95 transition-all">
              Cancel
            </button>
            <button rv-on-click="submit" rv-attr-disabled="submitting"
              class="flex-1 bg-secondary text-on-secondary-fixed px-md py-sm rounded-lg font-headline-sm text-[14px] font-bold active:scale-95 transition-all disabled:opacity-50">
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
      title: 'New Customer',
      breadcrumb: 'Customers > New',
      onBack: () => router.navigate('#/customers'),
    }),
    sidebar: createSidebarController({ activeRoute: ROUTE, router }),
    bottomNav: createBottomNavController({ activeRoute: ROUTE, router }),

    submitting: false,
    error: null,
    metadataError: null,

    _form: { reference: '', metadataRaw: '' },

    onReferenceInput(e) { self._form.reference = e.target.value.trim(); },
    onMetadataInput(e) {
      self._form.metadataRaw = e.target.value.trim();
      self.metadataError = null;
    },

    _parseMetadata() {
      const raw = self._form.metadataRaw;
      if (!raw) return { ok: true, value: undefined };
      try {
        return { ok: true, value: JSON.parse(raw) };
      } catch {
        return { ok: false, error: 'Metadata must be valid JSON.' };
      }
    },

    async submit() {
      self.error = null;
      self.metadataError = null;
      const meta = self._parseMetadata();
      if (!meta.ok) { self.metadataError = meta.error; return; }

      self.submitting = true;
      try {
        const body = {};
        if (self._form.reference) body.reference = self._form.reference;
        if (meta.value !== undefined) body.metadata = meta.value;
        await api.createCustomer(body);
        router.navigate('#/customers');
      } catch (e) {
        self.error = e.message;
      } finally {
        self.submitting = false;
      }
    },

    cancel() { router.navigate('#/customers'); },
  };
  return self;
}

export const CustomerCreateView = {
  mount(el, _params, { api, router }) {
    el.innerHTML = template;
    const scope = createController({ api, router });
    const binding = rivets.bind(el, scope);
    return { unbind() { binding.unbind(); } };
  },
};
