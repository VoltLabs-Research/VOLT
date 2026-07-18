import type { PersistedPluginDTO as PersistedPluginDTOContract } from '@shared/contracts/dtos/PersistedPluginDTO';
import type { Plugin, PluginProps } from '@modules/plugin/models/plugin/PluginModel';
import type { WorkflowProps } from '@modules/plugin/workflow/Workflow';
import { mapPluginToPersistedDTO as mapPluginToPersistedDTONeutral } from '@shared/application/utilities/mapPluginToPersistedDTO';

/**
 * Plugin-typed binding of the neutral, generic `PersistedPluginDTO` contract
 * (`@shared/contracts/dtos/PersistedPluginDTO`) to this module's concrete
 * `PluginProps`/`WorkflowProps`. Replaces the deleted
 * `dtos/plugin/PersistedPluginDTO.ts` re-export shim.
 */
export type PersistedPluginDTO = PersistedPluginDTOContract<PluginProps, WorkflowProps>;

/**
 * Plugin-typed binding over the neutral mapper
 * (`@shared/application/utilities/mapPluginToPersistedDTO`). Kept here so the
 * plugin module's internal callers retain the exact `Plugin` → `PersistedPluginDTO`
 * signature; cross-module consumers use the neutral generic mapper directly.
 */
export const mapPluginToPersistedDTO = (plugin: Plugin): PersistedPluginDTO =>
    mapPluginToPersistedDTONeutral(plugin) as PersistedPluginDTO;
