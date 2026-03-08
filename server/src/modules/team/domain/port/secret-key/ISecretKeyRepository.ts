import { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import SecretKey, { SecretKeyProps } from '@modules/team/domain/entities/secret-key/SecretKey';

export interface ISecretKeyRepository extends IBaseRepository<SecretKey, SecretKeyProps> {
    findActiveByRawKey(rawKey: string): Promise<SecretKey | null>;
    touchLastUsed(secretKeyId: string): Promise<void>;
};
