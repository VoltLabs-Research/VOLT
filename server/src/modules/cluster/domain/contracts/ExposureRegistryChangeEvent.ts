import type { TeamClusterServiceExposure } from '@modules/cluster/domain/contracts/TeamClusterServiceExposure';

export interface ExposureRegistryChangeEvent {
    teamClusterId: string;
    exposures: TeamClusterServiceExposure[];
}
