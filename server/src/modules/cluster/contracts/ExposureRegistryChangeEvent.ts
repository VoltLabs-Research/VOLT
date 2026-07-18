import type { TeamClusterServiceExposure } from '@modules/cluster/contracts/TeamClusterServiceExposure';

export interface ExposureRegistryChangeEvent {
    teamClusterId: string;
    exposures: TeamClusterServiceExposure[];
}
