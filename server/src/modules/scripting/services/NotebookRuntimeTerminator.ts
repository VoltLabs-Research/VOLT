import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import logger from '@shared/infrastructure/logger';
import teamClusterExposureRegistryService from '@modules/cluster/services/TeamClusterExposureRegistryService';
import { findNotebookExposure } from '@modules/scripting/utilities/jupyter-proxy';
import { container as diContainer } from 'tsyringe';

export class NotebookRuntimeTerminator {
    private readonly exposureRegistryService = teamClusterExposureRegistryService;

    #teamClusterDaemonClientCache?: ITeamClusterDaemonClient;
    private get teamClusterDaemonClient(): ITeamClusterDaemonClient {
        return (this.#teamClusterDaemonClientCache ??= diContainer.resolve<ITeamClusterDaemonClient>(SHARED_TOKENS.TeamClusterDaemonClient));
    }

    async terminate(teamClusterId: string, runtimeNotebookId: string): Promise<boolean> {
        const exposures = this.exposureRegistryService.listTeamClusterExposures(teamClusterId);
        const match = findNotebookExposure(exposures, runtimeNotebookId);
        const containerId = match?.exposure.containerId;

        if (!containerId) {
            return false;
        }

        try {
            await this.teamClusterDaemonClient.command(
                teamClusterId,
                ChannelCommands.ContainerDelete,
                { containerId }
            );
            return true;
        } catch (error: unknown) {
            logger.warn(
                { err: error, teamClusterId, runtimeNotebookId, containerId },
                '[Scripting] Failed to delete notebook container on daemon'
            );
            return false;
        }
    }
}

export default new NotebookRuntimeTerminator();
