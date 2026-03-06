import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import SSHConnection, { SSHConnectionProps } from '@modules/ssh/domain/entities/SSHConnection';

export interface ISSHConnectionRepository extends IBaseRepository<SSHConnection, SSHConnectionProps>{
    findByIdWithCredentials(id: string): Promise<SSHConnection | null>;
}