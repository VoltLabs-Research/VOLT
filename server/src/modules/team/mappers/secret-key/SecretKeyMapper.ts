import SecretKey, { SecretKeyProps } from '@modules/team/entities/secret-key/SecretKey';
import { SecretKeyDocument } from '@modules/team/models/secret-key/SecretKeyModel';
import { createMongoMapper } from '@shared/infrastructure/persistence/mongo/createMongoMapper';

export default createMongoMapper<SecretKey, SecretKeyProps, SecretKeyDocument>(SecretKey, ['team', 'role', 'createdBy']);
