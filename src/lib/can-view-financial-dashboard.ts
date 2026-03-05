export function canViewFinancialDashboard(
  capabilities?: Record<string, boolean> | null
): boolean {
  if (!capabilities) return false;

  // Canonical + aliases defensius (compat)
  return Boolean(
    capabilities['moviments.importarExtractes'] ||
      capabilities['moviments.editar'] ||
      capabilities['moviments.read'] ||
      capabilities['moviments.lectura']
  );
}
