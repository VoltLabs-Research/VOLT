import type { TeamClusterServiceExposure } from '@modules/cluster/utilities/teamClusterSocket';
import type { ExposureRegistryChangeEvent } from '@modules/cluster/contracts/ExposureRegistryChangeEvent';

export interface ITeamClusterExposureRegistryService {
    replaceTeamClusterExposures(teamClusterId: string, exposures: TeamClusterServiceExposure[]): void;
    clearTeamCluster(teamClusterId: string, emitEvent?: boolean): void;
    getTeamClusterExposure(teamClusterId: string, exposureId: string): TeamClusterServiceExposure | null;
    listTeamClusterExposures(teamClusterId: string): TeamClusterServiceExposure[];
    findTeamClusterExposure(
        teamClusterId: string,
        predicate: (exposure: TeamClusterServiceExposure) => boolean
    ): TeamClusterServiceExposure | null;
    listActiveTcpExposures(): TeamClusterServiceExposure[];
    onChanged(listener: (event: ExposureRegistryChangeEvent) => void): void;
    offChanged(listener: (event: ExposureRegistryChangeEvent) => void): void;
}
