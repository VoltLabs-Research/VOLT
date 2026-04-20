import AnalysisDeletedEvent from '@modules/analysis/domain/events/AnalysisDeletedEvent';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import type TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';

type DaemonListingDocumentType = 'listing' | 'sub-listing';

const DAEMON_LISTING_DOCUMENT_TYPES: DaemonListingDocumentType[] = ['listing', 'sub-listing'];

@injectable()
export default class AnalysisDeletedDaemonListingPurgeEventHandler implements IEventHandler<AnalysisDeletedEvent> {
    constructor(
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
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
};
