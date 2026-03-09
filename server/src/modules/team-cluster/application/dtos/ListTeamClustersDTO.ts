import type { PaginatedOutputDTO, PaginatedTeamScopedInputDTO } from '@modules/team/application/dtos/common';
import type { TeamClusterDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';

export type ListTeamClustersInputDTO = PaginatedTeamScopedInputDTO;

export type ListTeamClustersOutputDTO = PaginatedOutputDTO<TeamClusterDTO>;
