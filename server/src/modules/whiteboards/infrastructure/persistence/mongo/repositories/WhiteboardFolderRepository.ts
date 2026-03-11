import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import WhiteboardFolder from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import whiteboardFolderMapper from '@modules/whiteboards/infrastructure/persistence/mongo/mappers/WhiteboardFolderMapper';
import WhiteboardFolderModel from '@modules/whiteboards/infrastructure/persistence/mongo/models/WhiteboardFolderModel';
import { injectable } from 'tsyringe';
import type { PaginatedResult, PaginationOptions } from '@shared/domain/port/IBaseRepository';
import type { WhiteboardFolderProps } from '@modules/whiteboards/domain/entities/WhiteboardFolder';
import type { IWhiteboardFolderRepository } from '@modules/whiteboards/domain/port/IWhiteboardFolderRepository';
import type { WhiteboardFolderDocument } from '@modules/whiteboards/infrastructure/persistence/mongo/models/WhiteboardFolderModel';

@injectable()
export default class WhiteboardFolderRepository
    extends MongooseBaseRepository<WhiteboardFolder, WhiteboardFolderProps, WhiteboardFolderDocument>
    implements IWhiteboardFolderRepository {

    constructor() {
        super(WhiteboardFolderModel, whiteboardFolderMapper);
    }

    async findAllByTeamAndParent(
        teamId: string,
        parentId: string | null,
        options: PaginationOptions
    ): Promise<PaginatedResult<WhiteboardFolder>> {
        const page = options.page ?? 1;
        const limit = options.limit ?? 100;
        const skip = (page - 1) * limit;

        const filter = { team: teamId, parent: parentId };

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

    async findByTeamAndFolderId(teamId: string, folderId: string): Promise<WhiteboardFolder | null> {
        const doc = await this.model.findOne({ _id: folderId, team: teamId }).exec();
        return doc ? this.mapper.toDomain(doc) : null;
    }
};
