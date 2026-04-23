import { SYS_BUCKETS } from '@core/config/minio';
import type LatexDocumentDeletedEvent from '@modules/latex/domain/events/LatexDocumentDeletedEvent';
import LatexAssetRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexAssetRepository';
import LatexFileRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexFileRepository';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import { inject } from 'tsyringe';

/**
 * Cascades cleanup when a LaTeX document is deleted:
 * - Removes all asset files from MinIO and purges asset metadata.
 * - Deletes all LatexFile records associated with the document.
 */
@Subscribe('latex-document.deleted')
export default class LatexDocumentDeletedEventHandler implements IEventHandler<LatexDocumentDeletedEvent> {
    constructor(
        
        private readonly latexAssetRepository: LatexAssetRepository,

        
        private readonly latexFileRepository: LatexFileRepository,

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
