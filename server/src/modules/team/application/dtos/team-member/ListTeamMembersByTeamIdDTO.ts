import { PersistedEntityDTO, PaginatedOutputDTO, PaginatedTeamScopedInputDTO } from '@modules/team/application/dtos/common';
import { TeamMemberProps } from '@modules/team/domain/entities/team-member/TeamMember';

export type ListTeamMembersByTeamIdInputDTO = PaginatedTeamScopedInputDTO;

export interface TeamMemberStatsProps extends TeamMemberProps {
    timeSpentLast7Days: number;
    trajectoriesCount: number;
    analysesCount: number;
};

export type ListTeamMembersByTeamIdOutputDTO = PaginatedOutputDTO<PersistedEntityDTO<TeamMemberStatsProps>>;
