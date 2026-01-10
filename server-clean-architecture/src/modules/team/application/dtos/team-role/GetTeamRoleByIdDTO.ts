import { PaginatedResult } from "@/src/shared/domain/IBaseRepository";
import { TeamRoleProps } from "../../../domain/entities/TeamRole";

export interface GetTeamRoleByIdInputDTO{
    roleId: string;
};

export interface GetTeamRoleByIdOutputDTO extends TeamRoleProps{}