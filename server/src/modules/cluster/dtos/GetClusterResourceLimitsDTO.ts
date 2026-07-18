import type { TeamScopedEntityIdInputDTO } from '@modules/cluster/dtos/_teamScoped';
import type { SystemStatus } from '@modules/system/value-objects/SystemMetrics';

export type GetClusterResourceLimitsInputDTO = TeamScopedEntityIdInputDTO<'teamClusterId'>;

export interface ClusterResourceLimitsDTO {
    maxCpus: number | null;
    maxMemoryMB: number | null;
    status: SystemStatus | null;
    lastUpdatedAt: string | null;
}

export interface GetClusterResourceLimitsOutputDTO {
    resourceLimits: ClusterResourceLimitsDTO;
}
