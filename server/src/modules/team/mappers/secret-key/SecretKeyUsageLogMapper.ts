import SecretKeyUsageLog, { SecretKeyUsageLogProps } from '@modules/team/entities/secret-key/SecretKeyUsageLog';
import { SecretKeyUsageLogDocument } from '@modules/team/models/secret-key/SecretKeyUsageLogModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<SecretKeyUsageLog, SecretKeyUsageLogProps, SecretKeyUsageLogDocument>(SecretKeyUsageLog, ['secretKey', 'team']);
