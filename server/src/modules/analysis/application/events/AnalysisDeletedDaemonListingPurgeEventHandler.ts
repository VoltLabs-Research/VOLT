import AnalysisDeletedEvent from '@modules/analysis/domain/events/AnalysisDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import logger from '@shared/infrastructure/logger';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

type DaemonListingDocumentType = 'listing' | 'sub-listing';

const DAEMON_LISTING_DOCUMENT_TYPES: DaemonListingDocumentType[] = ['listing', 'sub-listing'];

@Subscribe('analysis.deleted')
export default class AnalysisDeletedDaemonListingPurgeEventHandler implements IEventHandler<AnalysisDeletedEvent> {
    constructor(
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {}

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
