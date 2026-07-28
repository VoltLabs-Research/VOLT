import { DefineEventGroup, Event } from '@shared/events/EventGroup';
import objectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import LatexAsset from '@modules/latex/models/LatexAsset';
import LatexFile from '@modules/latex/models/LatexFile';
import LatexService from '@modules/latex/services/LatexService';
import { buildLatexAssetStoragePrefix, requireLatexStorageClusterId } from '@modules/latex/services/LatexAssetStorage';
import latexSocketModule from '@modules/latex/socket/LatexSocketModule';

@DefineEventGroup('latex')
export default class LatexEvents {
    #service?: LatexService;

    @Event('latex-document.deleted')
    async cleanupDocumentAssets({ documentId, teamId, storageClusterId }: EventMap['latex-document.deleted']) {
        const storagePrefix = buildLatexAssetStoragePrefix(teamId, documentId);
        const resolvedStorageClusterId = requireLatexStorageClusterId(documentId, { storageClusterId });

        await Promise.all([
            objectGatewayClient.deleteByPrefix(resolvedStorageClusterId, TEAM_CLUSTER_BUCKETS.LATEX_ASSETS, storagePrefix),
            LatexAsset.delete({ document: documentId }),
            LatexFile.delete({ document: documentId })
        ]);
    }

    @Event('latex-file.content.updated')
    async applyAiContentToFile({ documentId, teamId, fileId, content }: EventMap['latex-file.content.updated']) {
        await latexSocketModule.applyAiContentToFile(documentId, teamId, fileId, content);
    }

    @Event('team.deleted')
    async deleteTeamDocuments({ teamId, userId }: EventMap['team.deleted']) {
        this.#service ??= new LatexService();
        await this.#service.deleteAllDocumentsForTeam(teamId, userId ?? '');
    }
}
