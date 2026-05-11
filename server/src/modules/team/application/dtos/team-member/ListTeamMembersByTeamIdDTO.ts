import { PaginatedOutputDTO, PaginatedTeamScopedInputDTO, PersistedEntityDTO } from '@modules/team/application/dtos/common';
import { TeamMemberProps } from '@modules/team/domain/entities/team-member/TeamMember';

export type ListTeamMembersByTeamIdInputDTO = PaginatedTeamScopedInputDTO;

export interface TeamMemberStatsProps extends TeamMemberProps {
    trajectoriesCount: number;
    analysesCount: number;
    latexCount: number;
    whiteboardsCount: number;
};

export type ListTeamMembersByTeamIdOutputDTO = PaginatedOutputDTO<PersistedEntityDTO<TeamMemberStatsProps>>;
