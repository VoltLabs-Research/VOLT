import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import logger from '@shared/infrastructure/logger';
import type { ITeamClusterExposureRegistryService } from '@shared/contracts/ports';
import { CLUSTER_SERVICE_TOKENS } from '@shared/contracts/tokens/ClusterServiceTokens';
import { findNotebookExposure } from '@modules/scripting/utilities/jupyter-proxy';
import { inject } from 'tsyringe';

/**
 * Tears down a notebook's runtime by deleting its `volt.managed` container
 * (resolved from the cluster exposure snapshot) via the generic
 * `container.delete` command. Replaces the former bespoke `notebook.delete` RPC
 * — a notebook is just a container, so it is deleted like any other.
 *
 * Best-effort: failures (daemon offline, container already gone, no exposure
 * published yet) are logged and swallowed, matching the previous behaviour where
 * session teardown never blocked notebook/trajectory deletion.
 */
@Singleton()
export class NotebookRuntimeTerminator {
    constructor(
        @inject(SHARED_TOKENS.TeamClusterDaemonClient) private readonly teamClusterDaemonClient: ITeamClusterDaemonClient,
        @inject(CLUSTER_SERVICE_TOKENS.TeamClusterExposureRegistryService) private readonly exposureRegistryService: ITeamClusterExposureRegistryService
    ) {}

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
