import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import LatexDocument from '@modules/latex/domain/entities/LatexDocument';
import latexDocumentMapper from '@modules/latex/infrastructure/persistence/mongo/mappers/LatexDocumentMapper';
import LatexDocumentModel from '@modules/latex/infrastructure/persistence/mongo/models/LatexDocumentModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

import type { LatexDocumentProps } from '@modules/latex/domain/entities/LatexDocument';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type { LatexDocumentDocument } from '@modules/latex/infrastructure/persistence/mongo/models/LatexDocumentModel';

@Singleton(LATEX_TOKENS.LatexDocumentRepository)
export default class LatexDocumentRepository
    extends MongooseBaseRepository<LatexDocument, LatexDocumentProps, LatexDocumentDocument>
    implements ILatexDocumentRepository {

    constructor() {
        super(LatexDocumentModel, latexDocumentMapper);
    }

    async findByTeamAndDocumentId(teamId: string, documentId: string): Promise<LatexDocument | null> {
        const doc = await this.model.findOne({ _id: documentId, team: teamId }).exec();
        return doc ? this.mapper.toDomain(doc) : null;
    }
}
