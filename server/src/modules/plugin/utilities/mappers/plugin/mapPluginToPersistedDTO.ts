import type { PersistedPluginDTO } from '@modules/plugin/dtos/plugin/PersistedPluginDTO';
import type Plugin from '@modules/plugin/entities/plugin/Plugin';
import { mapPluginToPersistedDTO as mapPluginToPersistedDTONeutral } from '@shared/application/utilities/mapPluginToPersistedDTO';

/**
 * Plugin-typed binding over the neutral mapper
 * (`@shared/application/utilities/mapPluginToPersistedDTO`). Kept here so the
 * plugin module's internal callers retain the exact `Plugin` → `PersistedPluginDTO`
 * signature; cross-module consumers use the neutral generic mapper directly.
 */
export const mapPluginToPersistedDTO = (plugin: Plugin): PersistedPluginDTO =>
    mapPluginToPersistedDTONeutral(plugin) as PersistedPluginDTO;
