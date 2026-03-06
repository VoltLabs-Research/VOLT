import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import Plugin, { PluginProps } from '@modules/plugin/domain/entities/Plugin';

export interface IPluginRepository extends IBaseRepository<Plugin, PluginProps> {
}