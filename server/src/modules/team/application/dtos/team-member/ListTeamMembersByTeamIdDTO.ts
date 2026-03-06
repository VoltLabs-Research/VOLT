import { PaginatedResult, PaginationOptions } from '@shared/domain/port/IBaseRepository';
import { TeamMemberProps } from '@modules/team/domain/entities/TeamMember';

export interface ListTeamMembersByTeamIdInputDTO extends PaginationOptions {
    teamId: string;
};

export interface TeamMemberStatsProps extends TeamMemberProps {
    timeSpentLast7Days: number;
    trajectoriesCount: number;
    analysesCount: number;
};

export interface ListTeamMembersByTeamIdOutputDTO extends PaginatedResult<TeamMemberStatsProps> { }