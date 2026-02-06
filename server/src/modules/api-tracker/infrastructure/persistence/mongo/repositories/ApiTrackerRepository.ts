import { injectable, inject } from 'tsyringe';
import { Model } from 'mongoose';
import { IApiTrackerRepository } from '@modules/api-tracker/domain/ports/IApiTrackerRepository';
import { ApiTrackerEntity } from '@modules/api-tracker/domain/entities/ApiTracker';
import { IApiTrackerDocument } from '@modules/api-tracker/infrastructure/persistence/mongo/models/ApiTrackerModel';

@injectable()
export class ApiTrackerRepository implements IApiTrackerRepository {
    constructor(
        @inject('ApiTrackerModel') private model: Model<IApiTrackerDocument>
    ){}

    async findByUserId(userId: string, page: number, limit: number): Promise<{ items: ApiTrackerEntity[]; total: number }> {
        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            this.model
                .find({ user: userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            this.model.countDocuments({ user: userId })
        ]);

        return {
            items: items.map(this.toEntity),
            total
        };
    }

    async deleteByUserId(userId: string): Promise<void> {
        await this.model.deleteMany({ user: userId });
    }

    private toEntity(doc: any): ApiTrackerEntity {
        return {
            id: doc._id.toString(),
            method: doc.method,
            url: doc.url,
            userAgent: doc.userAgent,
            ip: doc.ip,
            userId: doc.user?.toString(),
            statusCode: doc.statusCode,
            responseTime: doc.responseTime,
            requestBody: doc.requestBody,
            queryParams: doc.queryParams,
            headers: doc.headers,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
        };
    }
}
