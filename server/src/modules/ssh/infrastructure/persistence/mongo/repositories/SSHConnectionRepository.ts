import { ISSHConnectionRepository } from '@modules/ssh/domain/ports/ISSHConnectionRepository';
import SSHConnection, { SSHConnectionProps } from '@modules/ssh/domain/entities/SSHConnection';
import SSHConnectionModel, { SSHConnectionDocument } from '@modules/ssh/infrastructure/persistence/mongo/models/SSHConnectionModel';
import sshConnectionMapper from '@modules/ssh/infrastructure/persistence/mongo/mappers/SSHConnectionMapper';
import { injectable } from 'tsyringe';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

@injectable()
export default class SSHConnectionRepository
    extends MongooseBaseRepository<SSHConnection, SSHConnectionProps, SSHConnectionDocument>
    implements ISSHConnectionRepository{

    constructor(){
        super(SSHConnectionModel, sshConnectionMapper);
    }

    async findByIdWithCredentials(id: string): Promise<SSHConnection | null> {
        const doc = await this.model.findById(id).select('+encryptedPassword');
        return doc ? this.mapper.toDomain(doc) : null;
    }
};