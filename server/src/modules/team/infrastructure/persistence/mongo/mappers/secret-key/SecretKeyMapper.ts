import SecretKey, { SecretKeyProps } from '@modules/team/domain/entities/secret-key/SecretKey';
import { SecretKeyDocument } from '@modules/team/infrastructure/persistence/mongo/models/secret-key/SecretKeyModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<SecretKey, SecretKeyProps, SecretKeyDocument>(SecretKey, ['team', 'role', 'createdBy']);
