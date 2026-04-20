import { PLUGIN_TOKENS } from '@modules/plugin/infrastructure/di/PluginTokens';

import { CascadeDeleteEachOnTeamDeletedHandler } from '@shared/application/events/CascadeDeleteEachOnTeamDeletedHandler';
import { DeletePluginByIdUseCase } from '@modules/plugin/application/use-cases/plugin/DeletePluginByIdUseCase';
import { injectable, inject } from 'tsyringe';

import type Plugin from '@modules/plugin/domain/entities/plugin/Plugin';
import type { IPluginRepository } from '@modules/plugin/domain/port/plugin/IPluginRepository';

@injectable()
export default class TeamDeletedEventHandler extends CascadeDeleteEachOnTeamDeletedHandler<Plugin> {
    constructor(
        @inject(PLUGIN_TOKENS.PluginRepository)
        protected readonly repository: IPluginRepository,

        @inject(DeletePluginByIdUseCase)
        private readonly deletePluginByIdUseCase: DeletePluginByIdUseCase
    ) {
        super();
    }

    protected async deleteOne(pluginId: string): Promise<void> {
        await this.deletePluginByIdUseCase.execute({ pluginId });
    }
};
