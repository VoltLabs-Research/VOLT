import type StoragePlacement from '@modules/team-cluster/domain/entities/StoragePlacement';
import type { StoragePlacementProps } from '@modules/team-cluster/domain/entities/StoragePlacement';
import storagePlacementMapper from '@modules/team-cluster/infrastructure/persistence/mongo/mappers/StoragePlacementMapper';
import StoragePlacementModel, { StoragePlacementDocument } from '@modules/team-cluster/infrastructure/persistence/mongo/models/StoragePlacementModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import type { UpdateQuery } from 'mongoose';


@Singleton()
export default class StoragePlacementRepository
    extends MongooseBaseRepository<StoragePlacement, StoragePlacementProps, StoragePlacementDocument> {

    constructor() {
        super(StoragePlacementModel, storagePlacementMapper);
    }

    async findByScope(scopeType: StoragePlacementProps['scopeType'], scopeId: string): Promise<StoragePlacement | null> {
        const document = await this.model.findOne({
            scopeType,
            scopeId
        }).exec();

        return document ? this.mapper.toDomain(document) : null;
    }

    async upsertByScope(
        scopeType: StoragePlacementProps['scopeType'],
        scopeId: string,
        data: Partial<StoragePlacementProps>
    ): Promise<StoragePlacement> {
        const persistenceData = this.mapper.toPersistence(data);
        const document = await this.model.findOneAndUpdate(
            {
                scopeType,
                scopeId
            },
            {
                $set: persistenceData
            } as UpdateQuery<StoragePlacementDocument>,
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true
            }
        ).exec();

        return this.mapper.toDomain(document);
    }

    async listByPrimaryClusterId(teamId: string, primaryClusterId: string): Promise<StoragePlacement[]> {
        const documents = await this.model.find({
            team: teamId,
            primaryClusterId
        }).sort({
            updatedAt: 1
        }).exec();

        return documents.map((document) => this.mapper.toDomain(document));
    }
}
