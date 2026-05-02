import SSHConnection, { SSHConnectionProps } from '@modules/ssh/domain/entities/SSHConnection';
import sshConnectionMapper from '@modules/ssh/infrastructure/persistence/mongo/mappers/SSHConnectionMapper';
import SSHConnectionModel, { SSHConnectionDocument } from '@modules/ssh/infrastructure/persistence/mongo/models/SSHConnectionModel';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

@Singleton()
export default class SSHConnectionRepository
    extends MongooseBaseRepository<SSHConnection, SSHConnectionProps, SSHConnectionDocument>{

    constructor(){
        super(SSHConnectionModel, sshConnectionMapper);
    }

    async findByIdWithCredentials(id: string): Promise<SSHConnection | null> {
        const doc = await this.model.findById(id).select('+encryptedPassword');
        return doc ? this.mapper.toDomain(doc) : null;
    }
}