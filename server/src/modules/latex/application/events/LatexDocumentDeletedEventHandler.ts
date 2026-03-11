import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { SYS_BUCKETS } from '@core/config/minio';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';
import type LatexDocumentDeletedEvent from '@modules/latex/domain/events/LatexDocumentDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import type { ILatexAssetRepository } from '@modules/latex/domain/port/ILatexAssetRepository';
import type { ILatexFileRepository } from '@modules/latex/domain/port/ILatexFileRepository';
import type { IStorageService } from '@shared/domain/port/IStorageService';

/**
 * Cascades cleanup when a LaTeX document is deleted:
 * - Removes all asset files from MinIO and purges asset metadata.
 * - Deletes all LatexFile records associated with the document.
 */
@injectable()
export default class LatexDocumentDeletedEventHandler implements IEventHandler<LatexDocumentDeletedEvent> {
    constructor(
        @inject(LATEX_TOKENS.LatexAssetRepository)
        private readonly latexAssetRepository: ILatexAssetRepository,

        @inject(LATEX_TOKENS.LatexFileRepository)
        private readonly latexFileRepository: ILatexFileRepository,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
    ) {}

    async handle(event: LatexDocumentDeletedEvent): Promise<void> {
        const { documentId, teamId } = event.payload;
        const storagePrefix = `latex-assets/${teamId}/${documentId}/`;

        await Promise.all([
            this.storageService.deleteByPrefix(SYS_BUCKETS.LATEX_ASSETS, storagePrefix),
            this.latexAssetRepository.deleteMany({ document: documentId }),
            this.latexFileRepository.deleteMany({ document: documentId })
        ]);
    }
};
