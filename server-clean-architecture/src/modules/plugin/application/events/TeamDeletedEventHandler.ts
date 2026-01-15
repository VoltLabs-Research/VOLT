import { injectable, inject } from 'tsyringe';
import { IEventHandler } from '@/src/shared/application/events/IEventHandler';
import TeamDeletedEvent from '@/src/modules/team/domain/events/TeamDeletedEvent';
import { PLUGIN_TOKENS } from '../../infrastructure/di/PluginTokens';
import { IPluginRepository } from '../../domain/ports/IPluginRepository';

@injectable()
export default class TeamDeletedEventHandler implements IEventHandler<TeamDeletedEvent>{
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        private readonly pluginRepository: IPluginRepository
    ){}

    async handle(event: TeamDeletedEvent): Promise<void>{
        const { teamId } = event.payload;

        await this.pluginRepository.deleteMany({ team: teamId });
    }
};