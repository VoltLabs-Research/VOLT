import teamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import AnalysisDeletedEvent from '@modules/analysis/events/AnalysisDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { subscribeHandler } from '@shared/infrastructure/events/event-registry';
import logger from '@shared/infrastructure/logger';

type DaemonListingDocumentType = 'listing' | 'sub-listing';

const DAEMON_LISTING_DOCUMENT_TYPES: DaemonListingDocumentType[] = ['listing', 'sub-listing'];

class AnalysisDeletedDaemonListingPurgeEventHandler implements IEventHandler<AnalysisDeletedEvent> {
        private readonly teamClusterDaemonClient = teamClusterDaemonClient;

    async handle(event: AnalysisDeletedEvent): Promise<void> {
        const { analysisId, teamClusterId } = event.payload;
        if (!teamClusterId) {
            return;
        }

        for (const documentType of DAEMON_LISTING_DOCUMENT_TYPES) {
            try {
                await this.teamClusterDaemonClient.command(
                    teamClusterId,
                    ChannelCommands.PluginTransferMongoPurge,
                    {
                        analysisIds: [analysisId],
                        documentType
                    }
                );
            } catch (error) {
                logger.warn(
                    error,
                    `[AnalysisDeletedDaemonListingPurgeEventHandler] Failed to purge ${documentType} rows for analysis ${analysisId} on cluster ${teamClusterId}`
                );
            }
        }
    }
}

const analysisDeletedDaemonListingPurgeEventHandler = new AnalysisDeletedDaemonListingPurgeEventHandler();
subscribeHandler('analysis.deleted', analysisDeletedDaemonListingPurgeEventHandler);

export default analysisDeletedDaemonListingPurgeEventHandler;
