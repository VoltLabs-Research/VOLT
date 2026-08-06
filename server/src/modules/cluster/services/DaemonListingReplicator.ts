
import teamClusterDaemonClient from '@modules/cluster/services/TeamClusterDaemonClient';
import Analysis from '@modules/analysis/models/Analysis';
import {
    describeClusterTransferJob,
    type ClusterTransferJob
} from '@modules/cluster/contracts/cluster-transfer-job';
import type {
    StoragePlacementScopeType
} from '@shared/domain/contracts/team-cluster';
import {
    ChannelCommands,
    type PluginListingTransferKind,
    type PluginListingTransferExportResult,
    type PluginListingTransferImportResult,
    type PluginListingTransferPurgeResult
} from '@shared/infrastructure/contracts/team-cluster';
import logger from '@shared/infrastructure/logger';

const LISTING_TRANSFER_BATCH_SIZE = 200;
const LISTING_TRANSFER_KINDS: PluginListingTransferKind[] = ['listing', 'sub-listing'];

/**
 * Moves plugin listing rows between cluster databases during a
 * storage transfer, and purges them from the source once the copy is verified.
 */
export default class DaemonListingReplicator{
    #daemonClient = teamClusterDaemonClient;

    async replicateDaemonListings(job: ClusterTransferJob): Promise<void> {
        const analysisIds = await this.#resolveReplicationAnalysisIds(
            job.props.scopeType,
            job.props.scopeId,
            job.props.sourceClusterId
        );
        if (!analysisIds.length) {
            return;
        }

        logger.info(`Replicating daemon listing state for cluster transfer ${describeClusterTransferJob(job)}`);

        for (const documentType of LISTING_TRANSFER_KINDS) {
            let skip = 0;

            while (true) {
                const batch = await this.#daemonClient.command<PluginListingTransferExportResult>(
                    job.props.sourceClusterId,
                    ChannelCommands.PluginTransferListingsExport,
                    {
                        analysisIds,
                        documentType,
                        skip,
                        limit: LISTING_TRANSFER_BATCH_SIZE
                    },
                    {
                        timeoutClass: 'long-running-control-plane',
                        retryClass: 'safe-read'
                    }
                );

                if (batch.rows.length > 0) {
                    await this.#daemonClient.command<PluginListingTransferImportResult>(
                        job.props.destinationClusterId,
                        ChannelCommands.PluginTransferListingsImport,
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

        logger.info(`Replicated daemon listing state for cluster transfer ${describeClusterTransferJob(job)}`);
    }

    async purgeDaemonListings(
        sourceClusterId: string,
        scopeType: StoragePlacementScopeType,
        scopeId: string
    ): Promise<number> {
        const analysisIds = await this.#resolveReplicationAnalysisIds(scopeType, scopeId, sourceClusterId);
        if (!analysisIds.length) {
            return 0;
        }

        let deletedRows = 0;

        for (const documentType of LISTING_TRANSFER_KINDS) {
            const result = await this.#daemonClient.command<PluginListingTransferPurgeResult>(
                sourceClusterId,
                ChannelCommands.PluginTransferListingsPurge,
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

        logger.info(`Purged source daemon listing state for cluster transfer sourceClusterId=${sourceClusterId} scopeType=${scopeType} scopeId=${scopeId} analysisCount=${analysisIds.length}`);

        return deletedRows;
    }

    async #resolveReplicationAnalysisIds(
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

            return analysis.computeClusterId === sourceClusterId
                ? [analysis.id]
                : [];
        }

        const analyses = await Analysis.find({
            where: { trajectory: scopeId },
            order: { createdAt: 'ASC' }
        });

        return analyses
            .filter((analysis) => analysis.computeClusterId === sourceClusterId)
            .map((analysis) => analysis.id);
    }
}
