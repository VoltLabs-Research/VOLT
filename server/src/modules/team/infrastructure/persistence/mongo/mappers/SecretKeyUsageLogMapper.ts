import SecretKeyUsageLog, { SecretKeyUsageLogProps } from '@modules/team/domain/entities/SecretKeyUsageLog';
import { SecretKeyUsageLogDocument } from '@modules/team/infrastructure/persistence/mongo/models/SecretKeyUsageLogModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<SecretKeyUsageLog, SecretKeyUsageLogProps, SecretKeyUsageLogDocument>(SecretKeyUsageLog, ['secretKey', 'team']);
