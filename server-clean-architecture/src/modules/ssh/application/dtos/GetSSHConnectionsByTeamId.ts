import { PaginatedResult } from "@/src/shared/domain/ports/IBaseRepository";
import { SSHConnectionProps } from "../../domain/entities/SSHConnection";

export interface GetSSHConnectionsByTeamIdInputDTO{
    teamId: string;
};

export interface GetSSHConnectionsByTeamIdOutputDTO extends PaginatedResult<SSHConnectionProps>{}