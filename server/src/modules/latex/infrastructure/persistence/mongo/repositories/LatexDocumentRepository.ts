import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import LatexDocument from '@modules/latex/domain/entities/LatexDocument';
import latexDocumentMapper from '@modules/latex/infrastructure/persistence/mongo/mappers/LatexDocumentMapper';
import LatexDocumentModel from '@modules/latex/infrastructure/persistence/mongo/models/LatexDocumentModel';
import { injectable } from 'tsyringe';
import type { PaginatedResult, PaginationOptions } from '@shared/domain/port/IBaseRepository';
import type { LatexDocumentProps } from '@modules/latex/domain/entities/LatexDocument';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type { LatexDocumentDocument } from '@modules/latex/infrastructure/persistence/mongo/models/LatexDocumentModel';

@injectable()
export default class LatexDocumentRepository
    extends MongooseBaseRepository<LatexDocument, LatexDocumentProps, LatexDocumentDocument>
    implements ILatexDocumentRepository {

    constructor() {
        super(LatexDocumentModel, latexDocumentMapper);
    }

    async findAllByTeam(teamId: string, options: PaginationOptions): Promise<PaginatedResult<LatexDocument>> {
        const page = options.page ?? 1;
        const limit = options.limit ?? 100;
        const skip = (page - 1) * limit;

        const [docs, total] = await Promise.all([
            this.model.find({ team: teamId }).skip(skip).limit(limit).sort({ updatedAt: -1 }).exec(),
            this.model.countDocuments({ team: teamId })
        ]);

        return {
            data: docs.map((doc) => this.mapper.toDomain(doc)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async findByTeamAndDocumentId(teamId: string, documentId: string): Promise<LatexDocument | null> {
        const doc = await this.model.findOne({ _id: documentId, team: teamId }).exec();
        return doc ? this.mapper.toDomain(doc) : null;
    }
};
