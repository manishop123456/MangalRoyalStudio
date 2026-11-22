import { describe, expect, it } from 'vitest';
import { getPermittedModules, resolveVisibleModule } from './admin-navigation';

const modules = [
  { id: 'products', permission: 'PRODUCTS_VIEW' },
  { id: 'orders', permission: 'ORDERS_VIEW' },
  { id: 'staff', permission: 'USERS_MANAGE' },
] as const;

describe('admin navigation permissions', () => {
  it('shows only entries granted by the authenticated permission list', () => {
    expect(getPermittedModules(modules, ['ORDERS_VIEW'])).toEqual([modules[1]]);
  });

  it('does not show entries when permissions are absent', () => {
    expect(getPermittedModules(modules, undefined)).toEqual([]);
  });

  it('resolves stale selections to the first permitted module and no access to null', () => {
    expect(resolveVisibleModule([modules[1]], 'staff')).toBe('orders');
    expect(resolveVisibleModule([], 'staff')).toBeNull();
  });
});
