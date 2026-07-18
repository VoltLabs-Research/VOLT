import objectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import LatexAssetModel from '@modules/latex/models/LatexAssetModel';
import LatexFileModel from '@modules/latex/models/LatexFileModel';
import type LatexDocumentDeletedEvent from '@modules/latex/events/LatexDocumentDeletedEvent';
import { buildLatexAssetStoragePrefix, requireLatexStorageClusterId } from '@modules/latex/utilities/latex-storage';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';

@Subscribe('latex-document.deleted')
export default class LatexDocumentDeletedEventHandler implements IEventHandler<LatexDocumentDeletedEvent> {
    #objectGatewayClient = objectGatewayClient;

    async handle(event: LatexDocumentDeletedEvent): Promise<void> {
        const { documentId, teamId } = event.payload;
        const storagePrefix = buildLatexAssetStoragePrefix(teamId, documentId);
        const storageClusterId = requireLatexStorageClusterId(documentId, {
            storageClusterId: event.payload.storageClusterId
        });

        await Promise.all([
            this.#objectGatewayClient.deleteByPrefix(storageClusterId, TEAM_CLUSTER_BUCKETS.LATEX_ASSETS, storagePrefix),
            LatexAssetModel.deleteMany({ document: documentId }),
            LatexFileModel.deleteMany({ document: documentId })
        ]);
    }
}
