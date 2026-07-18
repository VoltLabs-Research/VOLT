import type { TeamMetricsSnapshot } from '@modules/trajectory/contracts/trajectory';

export interface GetTeamMetricsInputDTO {
    teamId: string;
};

export type GetTeamMetricsResultDTO = TeamMetricsSnapshot;
export type GetTeamMetricsOutputDTO = GetTeamMetricsResultDTO;
