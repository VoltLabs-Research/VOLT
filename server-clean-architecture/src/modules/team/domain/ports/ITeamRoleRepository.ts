import { IBaseRepository } from "@/src/shared/domain/ports/IBaseRepository";
import TeamRole, { TeamRoleProps } from '../entities/TeamRole';

export interface ITeamRoleRepository extends IBaseRepository<TeamRole, TeamRoleProps>{};