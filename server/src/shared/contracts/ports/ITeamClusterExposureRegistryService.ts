
import type { TeamClusterServiceExposure } from '@shared/contracts/types/TeamClusterExposure';

export interface ITeamClusterExposureRegistryService {
    listTeamClusterExposures(teamClusterId: string): TeamClusterServiceExposure[];
}
