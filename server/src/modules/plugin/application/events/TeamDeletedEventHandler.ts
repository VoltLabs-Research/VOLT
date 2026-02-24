import { injectable, inject } from 'tsyringe';
import { DeleteManyOnTeamDeletedHandler } from '@shared/application/events/DeleteManyOnTeamDeletedHandler';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import type { IPluginRepository } from '@modules/plugin/domain/ports/IPluginRepository';
import TeamDeletedEvent from '@modules/team/domain/events/TeamDeletedEvent';

@injectable()
export default class TeamDeletedEventHandler extends DeleteManyOnTeamDeletedHandler {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        protected readonly repository: IPluginRepository
    ) {
        super();
    }

    override async handle(event: TeamDeletedEvent): Promise<void> {
        await super.handle(event);
    }
};
