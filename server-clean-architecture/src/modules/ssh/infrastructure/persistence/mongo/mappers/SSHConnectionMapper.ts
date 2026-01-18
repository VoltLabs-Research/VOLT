import SSHConnection, { SSHConnectionProps } from '@modules/ssh/domain/entities/SSHConnection';
import { SSHConnectionDocument } from '@modules/ssh/infrastructure/persistence/mongo/models/SSHConnectionModel';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';

class SSHConnectionMapper extends BaseMapper<SSHConnection, SSHConnectionProps, SSHConnectionDocument>{
    constructor(){
        super(SSHConnection, [
            'user',
            'team'
        ]);
    }
};

export default new SSHConnectionMapper();