export type AdminPermissions = {
  clients: { view: boolean; edit: boolean; delete: boolean }
  gdpr: { view: boolean; withdraw: boolean; erase: boolean }
}

export const ALL_PERMISSIONS: AdminPermissions = {
  clients: { view: true, edit: true, delete: true },
  gdpr: { view: true, withdraw: true, erase: true },
}

export const NO_PERMISSIONS: AdminPermissions = {
  clients: { view: false, edit: false, delete: false },
  gdpr: { view: false, withdraw: false, erase: false },
}

export function parseAdminPermissions(raw: string | null | undefined): AdminPermissions {
  if (!raw) return NO_PERMISSIONS
  try {
    const parsed = JSON.parse(raw)
    const clients = parsed?.clients
    const gdpr = parsed?.gdpr
    if (
      typeof clients?.view !== "boolean" ||
      typeof clients?.edit !== "boolean" ||
      typeof clients?.delete !== "boolean" ||
      typeof gdpr?.view !== "boolean" ||
      typeof gdpr?.withdraw !== "boolean" ||
      typeof gdpr?.erase !== "boolean"
    ) {
      return NO_PERMISSIONS
    }
    return {
      clients: { view: clients.view, edit: clients.edit, delete: clients.delete },
      gdpr: { view: gdpr.view, withdraw: gdpr.withdraw, erase: gdpr.erase },
    }
  } catch {
    return NO_PERMISSIONS
  }
}

export function getPermissionsForRole(
  role: string,
  raw: string | null | undefined
): AdminPermissions {
  if (role === "SUPERADMIN") return ALL_PERMISSIONS
  if (role === "ADMIN") return parseAdminPermissions(raw)
  return NO_PERMISSIONS
}
