import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject } from 'tsyringe';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import type { ITeamClusterObjectGatewayClient } from '@shared/contracts/ports';
import LatexAssetModel from '@modules/latex/models/LatexAssetModel';
import LatexFileModel from '@modules/latex/models/LatexFileModel';
import type LatexDocumentDeletedEvent from '@modules/latex/events/LatexDocumentDeletedEvent';
import { buildLatexAssetStoragePrefix, requireLatexStorageClusterId } from '@modules/latex/utilities/latex-storage';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

/**
 * Cascades cleanup when a LaTeX document is deleted:
 * - Removes all asset files from object storage and purges asset metadata.
 * - Deletes all LatexFile records associated with the document.
 *
 * Uses the Mongoose models directly (the latex repository layer was removed in
 * the pollium conversion); still injects the cross-module object-gateway client.
 */
@Subscribe('latex-document.deleted')
export default class LatexDocumentDeletedEventHandler implements IEventHandler<LatexDocumentDeletedEvent> {
    constructor(
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
            LatexAssetModel.deleteMany({ document: documentId }),
            LatexFileModel.deleteMany({ document: documentId })
        ]);
    }
}
