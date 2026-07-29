
import teamClusterDaemonClient from '@modules/cluster/services/TeamClusterDaemonClient';
import Analysis from '@modules/analysis/models/Analysis';
import { type ClusterTransferJob } from '@modules/cluster/contracts/domain/cluster-transfer-job';
import { resolveAnalysisComputeClusterId } from '@shared/application/utilities/cluster-location';
import type {
    StoragePlacementScopeType
} from '@shared/domain/contracts/team-cluster';
import {
    ChannelCommands,
    type TeamClusterDaemonPluginMongoDocumentType,
    type TeamClusterDaemonPluginMongoExportResult,
    type TeamClusterDaemonPluginMongoImportResult,
    type TeamClusterDaemonPluginMongoPurgeResult
} from '@shared/infrastructure/contracts/team-cluster';
import logger from '@shared/infrastructure/logger';

const MONGO_TRANSFER_BATCH_SIZE = 200;
const MONGO_DOCUMENT_TYPES: TeamClusterDaemonPluginMongoDocumentType[] = ['listing', 'sub-listing'];

/**
 * Moves plugin listing documents between cluster Mongo instances during a
 * storage transfer, and purges them from the source once the copy is verified.
 */
export default class MongoListingReplicator{
    #daemonClient = teamClusterDaemonClient;

    async replicateMongoListings(job: ClusterTransferJob): Promise<void> {
        const analysisIds = await this.#resolveMongoReplicationAnalysisIds(
            job.props.scopeType,
            job.props.scopeId,
            job.props.sourceClusterId
        );
        if (!analysisIds.length) {
            return;
        }

        logger.info(`Replicating daemon Mongo listing state for cluster transfer transferJobId=${job.id} scopeType=${job.props.scopeType} scopeId=${job.props.scopeId} sourceClusterId=${job.props.sourceClusterId}`);

        for (const documentType of MONGO_DOCUMENT_TYPES) {
            let skip = 0;

            while (true) {
                const batch = await this.#daemonClient.command<TeamClusterDaemonPluginMongoExportResult>(
                    job.props.sourceClusterId,
                    ChannelCommands.PluginTransferMongoExport,
                    {
                        analysisIds,
                        documentType,
                        skip,
                        limit: MONGO_TRANSFER_BATCH_SIZE
                    },
                    {
                        timeoutClass: 'long-running-control-plane',
                        retryClass: 'safe-read'
                    }
                );

                if (batch.rows.length > 0) {
                    await this.#daemonClient.command<TeamClusterDaemonPluginMongoImportResult>(
                        job.props.destinationClusterId,
                        ChannelCommands.PluginTransferMongoImport,
                        {
                            analysisIds,
                            documentType,
                            rows: batch.rows
                        },
                        {
                            timeoutClass: 'long-running-control-plane',
                            retryClass: 'idempotent-command'
                        }
                    );
                }

                if (!batch.hasMore || batch.rows.length === 0) {
                    break;
                }

                skip = batch.nextSkip;
            }
        }

        logger.info(`Replicated daemon Mongo listing state for cluster transfer transferJobId=${job.id} scopeType=${job.props.scopeType} scopeId=${job.props.scopeId} sourceClusterId=${job.props.sourceClusterId}`);
    }

    async purgeMongoListings(
        sourceClusterId: string,
        scopeType: StoragePlacementScopeType,
        scopeId: string
    ): Promise<number> {
        const analysisIds = await this.#resolveMongoReplicationAnalysisIds(scopeType, scopeId, sourceClusterId);
        if (!analysisIds.length) {
            return 0;
        }

        let deletedRows = 0;

        for (const documentType of MONGO_DOCUMENT_TYPES) {
            const result = await this.#daemonClient.command<TeamClusterDaemonPluginMongoPurgeResult>(
                sourceClusterId,
                ChannelCommands.PluginTransferMongoPurge,
                {
                    analysisIds,
                    documentType
                },
                {
                    timeoutClass: 'long-running-control-plane',
                    retryClass: 'idempotent-command'
                }
            );
            deletedRows += result.deletedRows;
        }

        logger.info(`Purged source daemon Mongo listing state for cluster transfer sourceClusterId=${sourceClusterId} scopeType=${scopeType} scopeId=${scopeId} analysisCount=${analysisIds.length}`);

        return deletedRows;
    }

    async #resolveMongoReplicationAnalysisIds(
        scopeType: StoragePlacementScopeType,
        scopeId: string,
        sourceClusterId: string
    ): Promise<string[]> {
        if (scopeType === 'plugin-binary') {
            return [];
        }

        if (scopeType === 'analysis') {
            const analysis = await Analysis.findOneBy({ id: scopeId });
            if (!analysis) {
                return [];
            }

            return resolveAnalysisComputeClusterId({ computeClusterId: analysis.computeClusterId ?? undefined }) === sourceClusterId
                ? [analysis.id]
                : [];
        }

        const analyses = await Analysis.find({
            where: { trajectory: scopeId },
            order: { createdAt: 'ASC' }
        });

        return analyses
            .filter((analysis) => resolveAnalysisComputeClusterId({ computeClusterId: analysis.computeClusterId ?? undefined }) === sourceClusterId)
            .map((analysis) => analysis.id);
    }
}
