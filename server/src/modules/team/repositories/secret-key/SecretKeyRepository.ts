import SecretKey, { SecretKeyProps } from '@modules/team/entities/secret-key/SecretKey';
import type { ISecretKeyRepository } from '@modules/team/ports/secret-key/ISecretKeyRepository';
import { TEAM_TOKENS } from '@modules/team/di/TeamTokens';
import secretKeyMapper from '@modules/team/mappers/secret-key/SecretKeyMapper';
import SecretKeyModel, { SecretKeyDocument } from '@modules/team/models/secret-key/SecretKeyModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import crypto from 'node:crypto';


@Singleton(TEAM_TOKENS.SecretKeyRepository)
export default class SecretKeyRepository
    extends MongooseBaseRepository<SecretKey, SecretKeyProps, SecretKeyDocument>
    implements ISecretKeyRepository {

    constructor() {
        super(SecretKeyModel, secretKeyMapper);
    }

    async findActiveByRawKey(rawKey: string): Promise<SecretKey | null> {
        const keyHash = crypto.createHash('sha256')
            .update(rawKey)
            .digest('hex');

        const doc = await this.model.findOne({
            keyHash,
            isActive: true
        }).populate({
            path: 'role',
            select: ['name', 'permissions']
        }).exec();

        return doc ? this.mapper.toDomain(doc) : null;
    }

    async touchLastUsed(secretKeyId: string): Promise<void> {
        await this.model.updateOne({
            _id: secretKeyId
        }, {
            lastUsedAt: new Date()
        });
    }
};
