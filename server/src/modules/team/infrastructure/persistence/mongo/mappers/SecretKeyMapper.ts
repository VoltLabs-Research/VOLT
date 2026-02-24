import SecretKey, { SecretKeyProps } from '@modules/team/domain/entities/SecretKey';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';
import { SecretKeyDocument } from '@modules/team/infrastructure/persistence/mongo/models/SecretKeyModel';

class SecretKeyMapper extends BaseMapper<SecretKey, SecretKeyProps, SecretKeyDocument> {
    constructor() {
        super(SecretKey, ['team', 'role', 'createdBy']);
    }
};

export default new SecretKeyMapper();
