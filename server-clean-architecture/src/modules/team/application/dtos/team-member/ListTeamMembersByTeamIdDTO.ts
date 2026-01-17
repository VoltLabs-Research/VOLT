import { PaginatedResult, PaginationOptions } from "@/src/shared/domain/ports/IBaseRepository";
import { TeamMemberProps } from "../../../domain/entities/TeamMember";

export interface ListTeamMembersByTeamIdInputDTO extends PaginationOptions {
    teamId: string;
};

export interface TeamMemberStatsProps extends TeamMemberProps {
    timeSpentLast7Days: number;
    trajectoriesCount: number;
    analysesCount: number;
};

export interface ListTeamMembersByTeamIdOutputDTO extends PaginatedResult<TeamMemberStatsProps> { }