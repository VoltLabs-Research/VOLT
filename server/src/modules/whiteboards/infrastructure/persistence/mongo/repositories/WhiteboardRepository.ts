import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import Whiteboard from '@modules/whiteboards/domain/entities/Whiteboard';
import whiteboardMapper from '@modules/whiteboards/infrastructure/persistence/mongo/mappers/WhiteboardMapper';
import WhiteboardModel from '@modules/whiteboards/infrastructure/persistence/mongo/models/WhiteboardModel';
import { injectable } from 'tsyringe';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';
import type { IWhiteboardRepository, WhiteboardPaginationOptions } from '@modules/whiteboards/domain/port/IWhiteboardRepository';
import type { WhiteboardDocument } from '@modules/whiteboards/infrastructure/persistence/mongo/models/WhiteboardModel';

@injectable()
export default class WhiteboardRepository
    extends MongooseBaseRepository<Whiteboard, WhiteboardProps, WhiteboardDocument>
    implements IWhiteboardRepository {

    constructor() {
        super(WhiteboardModel, whiteboardMapper);
    }

    async findByTeamAndWhiteboardId(teamId: string, whiteboardId: string): Promise<Whiteboard | null> {
        const doc = await this.model.findOne({ _id: whiteboardId, team: teamId }).exec();
        return doc ? this.mapper.toDomain(doc) : null;
    }

    async findAllByTeam(teamId: string, options: WhiteboardPaginationOptions): Promise<PaginatedResult<Whiteboard>> {
        const page = options.page ?? 1;
        const limit = options.limit ?? 100;
        const skip = (page - 1) * limit;

        const filter: Record<string, unknown> = { team: teamId };

        if (options.folderId !== undefined && options.folderId !== 'all') {
            filter.folder = options.folderId;
        }

        const [docs, total] = await Promise.all([
            this.model.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }).exec(),
            this.model.countDocuments(filter)
        ]);

        return {
            data: docs.map((doc) => this.mapper.toDomain(doc)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }
};
