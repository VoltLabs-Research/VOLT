import { IBaseRepository } from '@shared/domain/ports/IBaseRepository';
import SecretKey, { SecretKeyProps } from '@modules/team/domain/entities/SecretKey';

export interface ISecretKeyRepository extends IBaseRepository<SecretKey, SecretKeyProps> {
    findActiveByRawKey(rawKey: string): Promise<SecretKey | null>;
    touchLastUsed(secretKeyId: string): Promise<void>;
};
