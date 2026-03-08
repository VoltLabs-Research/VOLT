import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

import { DeleteManyOnTeamDeletedHandler } from '@shared/application/events/DeleteManyOnTeamDeletedHandler';
import { injectable, inject } from 'tsyringe';

import type { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';

@injectable()
export default class TeamDeletedEventHandler extends DeleteManyOnTeamDeletedHandler {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        protected readonly repository: IPluginRepository
    ) {
        super();
    }
};
