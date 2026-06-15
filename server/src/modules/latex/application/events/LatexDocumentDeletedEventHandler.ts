import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import type { ILatexAssetRepository } from '@modules/latex/domain/port/ILatexAssetRepository';
import type { ILatexFileRepository } from '@modules/latex/domain/port/ILatexFileRepository';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject } from 'tsyringe';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import type { ITeamClusterObjectGatewayClient } from '@shared/contracts/ports';
import type LatexDocumentDeletedEvent from '@modules/latex/domain/events/LatexDocumentDeletedEvent';
import { buildLatexAssetStoragePrefix, requireLatexStorageClusterId } from '@modules/latex/application/utilities/latex-storage';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

/**
 * Cascades cleanup when a LaTeX document is deleted:
 * - Removes all asset files from MinIO and purges asset metadata.
 * - Deletes all LatexFile records associated with the document.
 */
@Subscribe('latex-document.deleted')
export default class LatexDocumentDeletedEventHandler implements IEventHandler<LatexDocumentDeletedEvent> {
    constructor(
        @inject(LATEX_TOKENS.LatexAssetRepository) private readonly latexAssetRepository: ILatexAssetRepository,
        @inject(LATEX_TOKENS.LatexFileRepository) private readonly latexFileRepository: ILatexFileRepository,
        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient) private readonly objectGatewayClient: ITeamClusterObjectGatewayClient
    ) {}

    async handle(event: LatexDocumentDeletedEvent): Promise<void> {
        const { documentId, teamId } = event.payload;
        const storagePrefix = buildLatexAssetStoragePrefix(teamId, documentId);
        const storageClusterId = requireLatexStorageClusterId(documentId, {
            storageClusterId: event.payload.storageClusterId
        });

        await Promise.all([
            this.objectGatewayClient.deleteByPrefix(storageClusterId, TEAM_CLUSTER_BUCKETS.LATEX_ASSETS, storagePrefix),
            this.latexAssetRepository.deleteMany({ document: documentId }),
            this.latexFileRepository.deleteMany({ document: documentId })
        ]);
    }
}
