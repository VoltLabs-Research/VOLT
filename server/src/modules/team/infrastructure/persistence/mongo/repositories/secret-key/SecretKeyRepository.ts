import SecretKey, { SecretKeyProps } from '@modules/team/domain/entities/secret-key/SecretKey';
import secretKeyMapper from '@modules/team/infrastructure/persistence/mongo/mappers/secret-key/SecretKeyMapper';
import SecretKeyModel, { SecretKeyDocument } from '@modules/team/infrastructure/persistence/mongo/models/secret-key/SecretKeyModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import crypto from 'node:crypto';


@Singleton()
export default class SecretKeyRepository
    extends MongooseBaseRepository<SecretKey, SecretKeyProps, SecretKeyDocument> {

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
