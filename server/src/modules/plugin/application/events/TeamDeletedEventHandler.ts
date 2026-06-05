import type PluginRepository from '@modules/plugin/infrastructure/persistence/mongo/repositories/plugin/PluginRepository';
import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

import { DeletePluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/DeletePluginByIdUseCase';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';

import type Plugin from '@modules/plugin/domain/entities/plugin/Plugin';
import { inject } from 'tsyringe';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<Plugin> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) protected readonly repository: PluginRepository,
        private readonly deletePluginByIdUseCase: DeletePluginByIdUseCase
    ) {
        super();
    }

    protected async deleteOne(pluginId: string): Promise<void> {
        await this.deletePluginByIdUseCase.execute({ pluginId });
    }
}
