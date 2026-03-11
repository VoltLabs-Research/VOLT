import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import LatexFolder from '@modules/latex/domain/entities/LatexFolder';
import latexFolderMapper from '@modules/latex/infrastructure/persistence/mongo/mappers/LatexFolderMapper';
import LatexFolderModel from '@modules/latex/infrastructure/persistence/mongo/models/LatexFolderModel';
import { injectable } from 'tsyringe';
import type { PaginatedResult, PaginationOptions } from '@shared/domain/port/IBaseRepository';
import type { LatexFolderProps } from '@modules/latex/domain/entities/LatexFolder';
import type { ILatexFolderRepository } from '@modules/latex/domain/port/ILatexFolderRepository';
import type { LatexFolderDocument } from '@modules/latex/infrastructure/persistence/mongo/models/LatexFolderModel';

@injectable()
export default class LatexFolderRepository
    extends MongooseBaseRepository<LatexFolder, LatexFolderProps, LatexFolderDocument>
    implements ILatexFolderRepository {

    constructor() {
        super(LatexFolderModel, latexFolderMapper);
    }

    async findAllByTeamAndParent(
        teamId: string,
        parentId: string | null,
        options: PaginationOptions
    ): Promise<PaginatedResult<LatexFolder>> {
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

    async findByTeamAndFolderId(teamId: string, folderId: string): Promise<LatexFolder | null> {
        const doc = await this.model.findOne({ _id: folderId, team: teamId }).exec();
        return doc ? this.mapper.toDomain(doc) : null;
    }
};
