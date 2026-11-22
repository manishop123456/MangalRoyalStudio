export interface PermissionModuleNavItem {
  id: string;
  permission: string;
}

export function getPermittedModules<T extends PermissionModuleNavItem>(
  modules: readonly T[],
  permissions: readonly string[] | undefined
): T[] {
  if (!permissions?.length) return [];
  const granted = new Set(permissions);
  return modules.filter((module) => granted.has(module.permission));
}

export function resolveVisibleModule<T extends PermissionModuleNavItem>(
  modules: readonly T[],
  selectedId: string
): string | null {
  return modules.some((module) => module.id === selectedId)
    ? selectedId
    : (modules[0]?.id ?? null);
}
