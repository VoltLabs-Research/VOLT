import crypto from 'node:crypto';
import { injectable } from 'tsyringe';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import SecretKey, { SecretKeyProps } from '@modules/team/domain/entities/SecretKey';
import { ISecretKeyRepository } from '@modules/team/domain/port/ISecretKeyRepository';
import SecretKeyModel, { SecretKeyDocument } from '@modules/team/infrastructure/persistence/mongo/models/SecretKeyModel';
import secretKeyMapper from '@modules/team/infrastructure/persistence/mongo/mappers/SecretKeyMapper';

@injectable()
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

        return doc ? this.mapper.toDomain(doc as SecretKeyDocument) : null;
    }

    async touchLastUsed(secretKeyId: string): Promise<void> {
        await this.model.updateOne({
            _id: secretKeyId
        }, {
            lastUsedAt: new Date()
        });
    }
}
