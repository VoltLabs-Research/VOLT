import type { TeamMetricsSnapshot } from '@modules/trajectory/domain/contracts/trajectory';

export interface GetTeamMetricsInputDTO {
    teamId: string;
};

export type GetTeamMetricsResultDTO = TeamMetricsSnapshot;
export type GetTeamMetricsOutputDTO = GetTeamMetricsResultDTO;
