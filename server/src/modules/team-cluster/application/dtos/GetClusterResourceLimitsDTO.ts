import type { TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';
import type { SystemStatus } from '@modules/system/domain/value-objects/SystemMetrics';

export type GetClusterResourceLimitsInputDTO = TeamScopedEntityIdInputDTO<'teamClusterId'>;

export interface ClusterResourceLimitsDTO {
    maxCpus: number | null;
    maxMemoryMB: number | null;
    status: SystemStatus | null;
    lastUpdatedAt: string | null;
};

export interface GetClusterResourceLimitsOutputDTO {
    resourceLimits: ClusterResourceLimitsDTO;
};
