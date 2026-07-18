/**
 * The canonical definition now lives in the neutral contracts layer
 * (`@shared/contracts/ports/IPluginRepository`) for the detachable-modules
 * migration (consumed by dashboard + cluster). That port is generic over the
 * entity/props; this module binds it to the concrete `Plugin`/`PluginProps` and
 * re-exports so existing importers of this module path compile unchanged.
 */
import type { IPluginRepository as IPluginRepositoryContract } from '@shared/contracts/ports/IPluginRepository';
import type { PluginProps } from '@modules/plugin/entities/plugin/Plugin';
import type Plugin from '@modules/plugin/entities/plugin/Plugin';

export type IPluginRepository = IPluginRepositoryContract<Plugin, PluginProps>;
