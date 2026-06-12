/**
 * The canonical definition now lives in the neutral contracts layer
 * (`@shared/contracts/dtos/PersistedPluginDTO`) for the detachable-modules
 * migration (consumed by dashboard). That DTO is generic over the props/workflow
 * shapes; this module binds it to the concrete `PluginProps`/`WorkflowProps` and
 * re-exports so existing importers (and `extends PersistedPluginDTO`
 * declarations) compile unchanged.
 */
import type { PersistedPluginDTO as PersistedPluginDTOContract } from '@shared/contracts/dtos/PersistedPluginDTO';
import type { PluginProps } from '@modules/plugin/domain/entities/plugin/Plugin';
import type { WorkflowProps } from '@modules/plugin/domain/entities/plugin/workflow/Workflow';

export type PersistedPluginDTO = PersistedPluginDTOContract<PluginProps, WorkflowProps>;
