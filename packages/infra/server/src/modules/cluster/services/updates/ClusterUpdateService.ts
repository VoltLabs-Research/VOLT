import TeamClusterEntity from '@modules/cluster/models/TeamCluster';
import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import { getServerVersion } from '@core/config/server-version';
import logger from '@shared/logger';
import { DaemonCommand } from '@volt/contracts/modules/cluster/daemon-commands';
import { normalizeVersion } from '@volt/contracts/modules/system/releases';
import type { DaemonRuntimeUpdatePayload } from '@volt/contracts/modules/system/domain';

type ClusterVersionFields = Pick<TeamClusterEntity, 'installRoot' | 'installedVersion'>;

// Clusters installed on other machines with install.sh run a copy of the daemon that only changes
// when they reinstall. The daemon of a deploy.sh stack lives in the server's own compose project
// and is updated with it, so only clusters with an install root are ever behind.
export const isClusterBehind = (cluster: ClusterVersionFields, serverVersion: string): boolean =>
    Boolean(cluster.installRoot)
    && (!cluster.installedVersion || normalizeVersion(cluster.installedVersion) !== serverVersion);

// Moves clusters to this server's release. Each daemon is asked once per release per server process,
// when it next reports in, so a daemon that cannot update itself is not asked again on every heartbeat.
class ClusterUpdateService{
    #requested = new Map<string, string>();

    async reconcile(teamClusterId: string): Promise<void>{
        const serverVersion = getServerVersion();
        if(!serverVersion || this.#requested.get(teamClusterId) === serverVersion) return;

        const cluster = await TeamClusterEntity.findOneBy({ id: teamClusterId });
        if(!cluster || !isClusterBehind(cluster, serverVersion)) return;

        const postgres = cluster.services?.postgres?.port;
        const daemon = cluster.services?.daemon?.port;
        if(!postgres || !daemon) return;

        this.#requested.set(teamClusterId, serverVersion);
        const payload: DaemonRuntimeUpdatePayload = {
            version: serverVersion,
            ports: {
                postgres,
                daemon
            }
        };

        try{
            const result = await teamClusterDaemonClient.commandWithSemanticResult<{ reason?: string }>(
                teamClusterId,
                DaemonCommand.RuntimeUpdate,
                payload,
                { timeoutClass: 'long-running-control-plane' }
            );
            if(result.accepted){
                logger.info(`[updates] cluster ${teamClusterId} is updating from ${cluster.installedVersion ?? 'an unknown release'} to ${serverVersion}`);
            }else{
                logger.warn(`[updates] cluster ${teamClusterId} did not update to ${serverVersion}: ${result.reason ?? result.data?.reason ?? 'rejected'}`);
            }
        }catch(error){
            // Daemons from before runtime.update don't know the command; they update by reinstalling.
            logger.warn(`[updates] could not ask cluster ${teamClusterId} to update to ${serverVersion}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    async countBehind(): Promise<number>{
        const serverVersion = getServerVersion();
        if(!serverVersion) return 0;

        const clusters = await TeamClusterEntity.find({
            select: {
                id: true,
                installRoot: true,
                installedVersion: true
            }
        });
        return clusters.filter((cluster) => isClusterBehind(cluster, serverVersion)).length;
    }
}

export default new ClusterUpdateService();
