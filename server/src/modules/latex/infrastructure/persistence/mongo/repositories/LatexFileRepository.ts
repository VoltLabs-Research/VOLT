import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import LatexFile from '@modules/latex/domain/entities/LatexFile';
import latexFileMapper from '@modules/latex/infrastructure/persistence/mongo/mappers/LatexFileMapper';
import LatexFileModel from '@modules/latex/infrastructure/persistence/mongo/models/LatexFileModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';

import type { LatexFileProps } from '@modules/latex/domain/entities/LatexFile';
import type { ILatexFileRepository } from '@modules/latex/domain/port/ILatexFileRepository';
import type { LatexFileDocument } from '@modules/latex/infrastructure/persistence/mongo/models/LatexFileModel';

@Singleton(LATEX_TOKENS.LatexFileRepository)
export default class LatexFileRepository
    extends MongooseBaseRepository<LatexFile, LatexFileProps, LatexFileDocument>
    implements ILatexFileRepository {

    constructor() {
        super(LatexFileModel, latexFileMapper);
    }

    async findAllByDocument(documentId: string): Promise<LatexFile[]> {
        const docs = await this.model
            .find({ document: documentId })
            .sort({ isEntrypoint: -1, createdAt: 1 })
            .exec();
        return docs.map((doc) => this.mapper.toDomain(doc));
    }

    async findByDocumentAndFileId(documentId: string, fileId: string): Promise<LatexFile | null> {
        const doc = await this.model
            .findOne({ _id: fileId, document: documentId })
            .exec();
        return doc ? this.mapper.toDomain(doc) : null;
    }

    /**
     * Atomically clears `isEntrypoint` from all files in the document
     * before setting a new entrypoint. Call this inside `SetLatexFileEntrypointUseCase`.
     */
    async clearEntrypointForDocument(documentId: string): Promise<void> {
        await this.model.updateMany(
            { document: documentId, isEntrypoint: true },
            { $set: { isEntrypoint: false } }
        ).exec();
    }
}
