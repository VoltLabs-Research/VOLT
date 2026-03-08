import Plugin, { PluginProps } from '@modules/plugin/domain/entities/plugin/Plugin';

import { IBaseRepository } from '@shared/domain/port/IBaseRepository';

export interface IPluginRepository extends IBaseRepository<Plugin, PluginProps> {
};