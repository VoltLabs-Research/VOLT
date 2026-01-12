import { IBaseRepository } from "@/src/shared/domain/ports/IBaseRepository";
import SSHConnection, { SSHConnectionProps } from "../entities/SSHConnection";

export interface ISSHConnectionRepository extends IBaseRepository<SSHConnection, SSHConnectionProps>{}