import type { IPluginRepository } from '@modules/plugin/ports/plugin/IPluginRepository';
import { PLUGIN_TOKENS } from '@modules/plugin/di/PluginTokens';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

import { DeletePluginByIdUseCase } from '@modules/plugin/use-cases/plugin/DeletePluginByIdUseCase';
import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';

import type Plugin from '@modules/plugin/entities/plugin/Plugin';
import { inject } from 'tsyringe';

@Subscribe('team.deleted')
export default class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<Plugin> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository) protected readonly repository: IPluginRepository,
        private readonly deletePluginByIdUseCase: DeletePluginByIdUseCase
    ) {
        super();
    }

    protected async deleteOne(pluginId: string): Promise<void> {
        await this.deletePluginByIdUseCase.execute({ pluginId });
    }
}
