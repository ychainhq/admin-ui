import { createActiveTenantController } from '../../src/components/ActiveTenantBadge.js';

describe('createActiveTenantController', () => {
  beforeEach(() => sessionStorage.clear());

  test('isEmpty when no active tenant is stored', () => {
    const ctrl = createActiveTenantController();
    expect(ctrl.isEmpty).toBe(true);
    expect(ctrl.isSet).toBe(false);
  });

  test('name and id are empty strings when no tenant', () => {
    const ctrl = createActiveTenantController();
    expect(ctrl.name).toBe('');
    expect(ctrl.id).toBe('');
  });

  test('isSet when active tenant exists in sessionStorage', () => {
    sessionStorage.setItem('chain_api_active_tenant', JSON.stringify({ id: 'ten_01', name: 'BlackRock Alpha' }));
    const ctrl = createActiveTenantController();
    expect(ctrl.isSet).toBe(true);
    expect(ctrl.isEmpty).toBe(false);
  });

  test('name and id are populated from sessionStorage', () => {
    sessionStorage.setItem('chain_api_active_tenant', JSON.stringify({ id: 'ten_01', name: 'BlackRock Alpha' }));
    const ctrl = createActiveTenantController();
    expect(ctrl.name).toBe('BlackRock Alpha');
    expect(ctrl.id).toBe('ten_01');
  });

  test('handles corrupted sessionStorage gracefully', () => {
    sessionStorage.setItem('chain_api_active_tenant', 'not-valid-json{{');
    const ctrl = createActiveTenantController();
    expect(ctrl.isEmpty).toBe(true);
    expect(ctrl.isSet).toBe(false);
  });
});
