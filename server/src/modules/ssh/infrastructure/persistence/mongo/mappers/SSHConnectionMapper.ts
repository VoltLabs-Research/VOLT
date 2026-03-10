import SSHConnection, { SSHConnectionProps } from '@modules/ssh/domain/entities/SSHConnection';
import { SSHConnectionDocument } from '@modules/ssh/infrastructure/persistence/mongo/models/SSHConnectionModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<SSHConnection, SSHConnectionProps, SSHConnectionDocument>(SSHConnection, [
    'user',
    'team'
]);
