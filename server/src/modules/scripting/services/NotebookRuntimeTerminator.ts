import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import logger from '@shared/infrastructure/logger';
import teamClusterExposureRegistryService from '@modules/cluster/services/team-cluster/TeamClusterExposureRegistryService';
import { findNotebookExposure } from '@modules/scripting/services/ScriptingJupyterProxySupport';

class NotebookRuntimeTerminator {
    async terminate(teamClusterId: string, runtimeNotebookId: string): Promise<boolean> {
        const exposures = teamClusterExposureRegistryService.listTeamClusterExposures(teamClusterId);
        const match = findNotebookExposure(exposures, runtimeNotebookId);
        const containerId = match?.exposure.containerId;

        if (!containerId) {
            return false;
        }

        try {
            await teamClusterDaemonClient.command(
                teamClusterId,
                ChannelCommands.ContainerDelete,
                { containerId }
            );
            return true;
        } catch (error: unknown) {
            logger.warn(
                {
                    err: error,
                    teamClusterId,
                    runtimeNotebookId,
                    containerId
                },
                '[Scripting] Failed to delete notebook container on daemon'
            );
            return false;
        }
    }
}

export default new NotebookRuntimeTerminator();
