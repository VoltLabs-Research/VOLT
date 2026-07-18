import type { PersistedPluginDTO as PersistedPluginDTOContract } from '@shared/contracts/dtos/PersistedPluginDTO';
import type { Plugin, PluginProps } from '@modules/plugin/models/plugin/PluginModel';
import type { WorkflowProps } from '@modules/plugin/workflow/Workflow';
import { mapPluginToPersistedDTO as mapPluginToPersistedDTONeutral } from '@shared/application/utilities/mapPluginToPersistedDTO';

export type PersistedPluginDTO = PersistedPluginDTOContract<PluginProps, WorkflowProps>;

export const mapPluginToPersistedDTO = (plugin: Plugin): PersistedPluginDTO =>
    mapPluginToPersistedDTONeutral(plugin) as PersistedPluginDTO;
