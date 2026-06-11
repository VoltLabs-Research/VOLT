import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type { PluginProps } from '@modules/plugin/domain/entities/plugin/Plugin';
import type Plugin from '@modules/plugin/domain/entities/plugin/Plugin';

export interface IPluginRepository extends IBaseRepository<Plugin, PluginProps> {
    findByIds(ids: string[]): Promise<Plugin[]>;
    findByTeamAndModifierKey(teamId: string, modifierKey: string): Promise<Plugin | null>;
}
