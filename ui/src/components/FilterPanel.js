const inputClass  = 'w-full glass-card border border-white/10 rounded-lg px-3 py-2 text-body-sm text-on-surface bg-transparent focus:ring-1 focus:ring-secondary outline-none placeholder:text-on-surface-variant/40';
const labelClass  = 'block text-label-sm text-on-surface-variant mb-1';
const selectClass = `${inputClass} cursor-pointer appearance-none`;

const toggleRowClass = 'flex items-center justify-between text-label-sm font-semibold uppercase tracking-wider text-on-surface-variant/60 mb-sm cursor-pointer select-none hover:text-on-surface-variant/80 transition-colors -mx-1 px-1 rounded';
const badgeClass     = 'normal-case tracking-normal text-[11px] font-semibold text-secondary bg-secondary/10 border border-secondary/20 px-2 py-0.5 rounded-full';

const defaultHelpHtml = 'Use <code class="text-secondary font-mono">*</code> as wildcard.';

function sectionHead(bindName, key, label) {
  return `
<div rv-on-click="${bindName}.sections.${key}.toggle" class="${toggleRowClass}">
  <span>${label}</span>
  <span class="flex items-center gap-xs">
    <span rv-show="${bindName}.sections.${key}.activeCount" class="${badgeClass}">
      <span rv-text="${bindName}.sections.${key}.activeCount"></span> active
    </span>
    <span rv-show="${bindName}.sections.${key}.expanded" class="material-symbols-outlined text-[16px]">expand_less</span>
    <span rv-hide="${bindName}.sections.${key}.expanded" class="material-symbols-outlined text-[16px]">expand_more</span>
  </span>
</div>`;
}

function fieldHtml(bindName, field) {
  if (field.type === 'select') {
    return `
      <div>
        <label class="${labelClass}">${field.label}</label>
        <select rv-on-change="${bindName}.onFormInput" name="${field.name}" class="${selectClass}">
          <option rv-each-f="${bindName}.optionSets.${field.name}" rv-attr-value="f.value" rv-text="f.label"></option>
        </select>
      </div>`;
  }

  const maxLength = field.maxLength ? ` maxlength="${field.maxLength}"` : '';
  return `
      <div>
        <label class="${labelClass}">${field.label}</label>
        <input rv-on-input="${bindName}.onFormInput" name="${field.name}" type="${field.inputType || 'text'}" placeholder="${field.placeholder || ''}"${maxLength} class="${inputClass}">
      </div>`;
}

export function createFilterPanelTemplate(config) {
  const bindName = config.bindName || 'filterForm';
  const title = config.title || 'Filters';
  const helpHtml = config.helpHtml ?? defaultHelpHtml;

  const sectionsHtml = config.sections.map(section => `
  ${sectionHead(bindName, section.key, section.label)}
  <div rv-show="${bindName}.sections.${section.key}.expanded">
    <div class="${section.gridClass || 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-sm mb-md'}">
${section.fields.map(field => fieldHtml(bindName, field)).join('')}
    </div>
  </div>`).join('');

  return `
<div class="glass-card rounded-xl p-md mb-gutter">

  <h3 class="text-title-md font-semibold text-on-surface mb-md">${title}</h3>

${sectionsHtml}

  <div class="flex items-center justify-between pt-md border-t border-white/10">
    <p class="text-body-sm text-on-surface-variant/60 hidden sm:block">${helpHtml}</p>
    <div class="flex gap-sm ml-auto">
      <button rv-on-click="${bindName}.onClear"
        class="px-md py-2 rounded-lg border border-white/10 text-label-md text-on-surface-variant hover:bg-white/5 transition-colors">
        Clear
      </button>
      <button rv-on-click="${bindName}.onSearch"
        class="flex items-center gap-xs px-md py-2 rounded-lg bg-secondary text-on-secondary-fixed text-label-md font-semibold hover:brightness-110 transition-all">
        <span class="material-symbols-outlined text-[18px]">search</span>
        Search
      </button>
    </div>
  </div>

</div>`;
}

export function createFilterPanelController(config, { onSearch, onClear }) {
  const makeSection = (expanded) => {
    const section = {
      expanded,
      activeCount: 0,
      toggle(e) { e?.preventDefault(); section.expanded = !section.expanded; },
    };
    return section;
  };

  const fields = config.sections.flatMap(section => section.fields.map(field => ({ ...field, sectionKey: section.key })));

  const self = {
    optionSets: {},
    sections: {},
    _form: {},

    onFormInput(e) {
      const fieldName = e.target.name;
      if (!fieldName) return;
      const options = e.target.tagName === 'SELECT' ? self.optionSets[fieldName] : null;
      self._form[fieldName] = options ? (options[e.target.selectedIndex]?.value ?? e.target.value) : e.target.value;
      syncCounts();
    },

    onSearch(e) {
      e?.preventDefault();
      const filters = {};
      for (const field of fields) {
        const raw = self._form[field.name];
        const value = field.normalize
          ? field.normalize(raw)
          : ((raw && String(raw).trim()) || undefined);
        filters[field.name] = value;
      }
      onSearch(filters);
    },

    onClear(e) {
      e?.preventDefault();
      Object.keys(self._form).forEach(key => { self._form[key] = ''; });
      syncCounts();
      onClear();
    },
  };

  for (const section of config.sections) {
    self.sections[section.key] = makeSection(Boolean(section.expanded));
    for (const field of section.fields) {
      self._form[field.name] = '';
      if (field.type === 'select') self.optionSets[field.name] = field.options || [];
    }
  }

  function syncCounts() {
    for (const section of config.sections) {
      self.sections[section.key].activeCount = section.fields
        .filter(field => self._form[field.name])
        .length;
    }
  }

  return self;
}
