import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { container as diContainer } from 'tsyringe';
import type { ITeamClusterDaemonClient } from '@shared/domain/port/ITeamClusterDaemonClient';
import AnalysisDeletedEvent from '@modules/analysis/events/AnalysisDeletedEvent';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import logger from '@shared/infrastructure/logger';

type DaemonListingDocumentType = 'listing' | 'sub-listing';

const DAEMON_LISTING_DOCUMENT_TYPES: DaemonListingDocumentType[] = ['listing', 'sub-listing'];

@Subscribe('analysis.deleted')
export default class AnalysisDeletedDaemonListingPurgeEventHandler implements IEventHandler<AnalysisDeletedEvent> {
    #teamClusterDaemonClientCache?: ITeamClusterDaemonClient;
    private get teamClusterDaemonClient(): ITeamClusterDaemonClient {
        return (this.#teamClusterDaemonClientCache ??= diContainer.resolve<ITeamClusterDaemonClient>(SHARED_TOKENS.TeamClusterDaemonClient));
    }

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
