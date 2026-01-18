import { IBaseRepository } from '@shared/domain/ports/IBaseRepository';
import SSHConnection, { SSHConnectionProps } from '@modules/ssh/domain/entities/SSHConnection';

export interface ISSHConnectionRepository extends IBaseRepository<SSHConnection, SSHConnectionProps>{
    findByIdWithCredentials(id: string): Promise<SSHConnection | null>;
}