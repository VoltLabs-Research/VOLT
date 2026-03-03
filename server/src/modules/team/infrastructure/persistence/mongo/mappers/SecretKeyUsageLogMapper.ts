import SecretKeyUsageLog, { SecretKeyUsageLogProps } from '@modules/team/domain/entities/SecretKeyUsageLog';
import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';
import { SecretKeyUsageLogDocument } from '@modules/team/infrastructure/persistence/mongo/models/SecretKeyUsageLogModel';

class SecretKeyUsageLogMapper extends BaseMapper<SecretKeyUsageLog, SecretKeyUsageLogProps, SecretKeyUsageLogDocument> {
    constructor() {
        super(SecretKeyUsageLog, ['secretKey', 'team']);
    }
};

export default new SecretKeyUsageLogMapper();
