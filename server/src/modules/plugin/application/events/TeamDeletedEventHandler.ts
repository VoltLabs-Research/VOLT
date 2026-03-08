import { injectable, inject } from 'tsyringe';
import { DeleteManyOnTeamDeletedHandler } from '@shared/application/events/DeleteManyOnTeamDeletedHandler';
import { PLUGIN_TOKENS } from '@modules/plugin/application/di/PluginTokens';
import type { IPluginRepository } from '@modules/plugin/domain/port/IPluginRepository';

@injectable()
export default class TeamDeletedEventHandler extends DeleteManyOnTeamDeletedHandler {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        protected readonly repository: IPluginRepository
    ) {
        super();
    }
};
