/**
 * Neutral, cross-module repository-port contract for the Plugin domain.
 * Extracted from `@modules/plugin/domain/port/plugin/IPluginRepository` during
 * the detachable-modules migration so consumers (dashboard, cluster, …) inject
 * against a contract rather than `@modules/plugin`.
 *
 * The plugin entity/props classes are NOT part of the neutral contracts layer,
 * so this port is GENERIC over them (`TPlugin`/`TPluginProps`). The owner module
 * re-exports a bound alias (`IPluginRepository = IPluginRepository<Plugin,
 * PluginProps>`) so existing importers compile unchanged.
 */
import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';

export interface IPluginRepository<TPlugin = unknown, TPluginProps = unknown>
    extends IBaseRepository<TPlugin, TPluginProps> {
    findByIds(ids: string[]): Promise<TPlugin[]>;
    findByTeamAndModifierKey(teamId: string, modifierKey: string): Promise<TPlugin | null>;
}
