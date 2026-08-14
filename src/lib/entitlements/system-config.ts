import { ENTITLEMENTS_CATALOG_VERSION } from './catalog';
import type {
  EntitlementEnforcementMode,
  EntitlementSystemConfig,
  ResolvedEntitlementSystemConfig,
} from './types';

const MODES: readonly EntitlementEnforcementMode[] = ['off', 'shadow', 'active'];

/**
 * The configuration document is the single authority for enforcement mode.
 * Missing, malformed or unknown versions fail safe to active so premium
 * capabilities cannot be reopened by deleting or corrupting the document.
 */
export function resolveEntitlementSystemConfig(
  input: Partial<EntitlementSystemConfig> | null | undefined
): ResolvedEntitlementSystemConfig {
  const diagnostics: string[] = [];
  if (!input) diagnostics.push('system_config_absent');

  const mode = input?.enforcementMode;
  if (!MODES.includes(mode as EntitlementEnforcementMode)) {
    diagnostics.push('system_config_mode_invalid');
  }
  if (input?.catalogVersion !== ENTITLEMENTS_CATALOG_VERSION) {
    diagnostics.push('system_config_version_incompatible');
  }

  const compatible = diagnostics.length === 0;
  return {
    enforcementMode: compatible ? mode as EntitlementEnforcementMode : 'active',
    compatible,
    diagnostics,
  };
}
