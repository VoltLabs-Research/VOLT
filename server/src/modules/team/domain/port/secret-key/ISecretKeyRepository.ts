import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';
import type SecretKey from '@modules/team/domain/entities/secret-key/SecretKey';
import type { SecretKeyProps } from '@modules/team/domain/entities/secret-key/SecretKey';

export interface ISecretKeyRepository extends IBaseRepository<SecretKey, SecretKeyProps> {
    findActiveByRawKey(rawKey: string): Promise<SecretKey | null>;
    touchLastUsed(secretKeyId: string): Promise<void>;
}
