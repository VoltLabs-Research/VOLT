import type { TeamMetricMetaEntry, TeamMetricsSnapshot } from '@modules/trajectory/domain/contracts/trajectory';

export interface GetTeamMetricsInputDTO {
    teamId: string;
};

export type GetTeamMetricsResultDTO = TeamMetricsSnapshot;

interface MetricMeta extends Omit<TeamMetricMetaEntry, 'target'> {
    displayName?: string;
    listingUrl?: string;
    pluginName?: string;
};

export interface GetTeamMetricsOutputDTO extends Omit<GetTeamMetricsResultDTO, 'meta'> {
    meta?: Record<string, MetricMeta>;
};
