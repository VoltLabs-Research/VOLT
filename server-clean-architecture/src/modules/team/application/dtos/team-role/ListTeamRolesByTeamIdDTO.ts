import { PaginatedResult, PaginationOptions } from "@/src/shared/domain/IBaseRepository";
import { TeamRoleProps } from "../../../domain/entities/TeamRole";

export interface ListTeamRolesByTeamIdInputDTO extends PaginationOptions{
    teamId: string;
};

export interface ListTeamRolesByTeamIdOutputDTO extends TeamRoleProps{}