import AnalysisDeletedEvent from '@modules/analysis/domain/events/AnalysisDeletedEvent';
import type { AnalysisStorageCleanupTarget } from '@modules/analysis/utilities/storage-cleanup-prefixes';
import { getAnalysisStorageCleanupTargets } from '@modules/analysis/utilities/storage-cleanup-prefixes';
import ClusterTransferJobRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/ClusterTransferJobRepository';
import StoragePlacementRepository from '@modules/team-cluster/infrastructure/persistence/mongo/repositories/StoragePlacementRepository';
import TeamClusterObjectGatewayClient from '@modules/team-cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import type { IEventHandler } from '@shared/application/events/IEventHandler';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { Subscribe } from '@shared/infrastructure/events/Subscribe';
import logger from '@shared/infrastructure/logger';
import { inject } from 'tsyringe';

@Subscribe('analysis.deleted')
export default class AnalysisDeletedStorageCleanupEventHandler implements IEventHandler<AnalysisDeletedEvent> {
    constructor(
        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService,

        
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient,

        
        private readonly storagePlacementRepository: StoragePlacementRepository,

        
        private readonly clusterTransferJobRepository: ClusterTransferJobRepository
    ) {}

    async handle(event: AnalysisDeletedEvent): Promise<void> {
        const { analysisId, trajectoryId, teamClusterId } = event.payload;
        const targets = getAnalysisStorageCleanupTargets(trajectoryId, analysisId);

        await Promise.all([
            this.cleanupLocalStorage(targets),
            teamClusterId
                ? this.cleanupRemoteStorage(teamClusterId, targets)
                : Promise.resolve(),
            this.storagePlacementRepository.deleteMany({
                scopeType: 'analysis',
                scopeId: analysisId
            }),
            this.clusterTransferJobRepository.deleteMany({
                scopeType: 'analysis',
                scopeId: analysisId
            })
        ]);
    }

    private async cleanupLocalStorage(targets: AnalysisStorageCleanupTarget[]): Promise<void> {
        const results = await Promise.allSettled(
            targets.map((target) => this.storageService.deleteByPrefix(target.bucket, target.prefix))
        );

        this.logFailures('local', results, targets);
    }

    private async cleanupRemoteStorage(
        teamClusterId: string,
        targets: AnalysisStorageCleanupTarget[]
    ): Promise<void> {
        const results = await Promise.allSettled(
            targets.map((target) => this.objectGatewayClient.deleteByPrefix(
                teamClusterId,
                target.bucket,
                target.prefix
            ))
        );

        this.logFailures(`team cluster ${teamClusterId}`, results, targets);
    }

    private logFailures(
        targetName: string,
        results: PromiseSettledResult<unknown>[],
        targets: AnalysisStorageCleanupTarget[]
    ): void {
        results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                return;
            }

            const target = targets[index];
            logger.warn(
                result.reason,
                `[AnalysisDeletedStorageCleanupEventHandler] Failed to delete ${targetName} storage prefix ${target.bucket}/${target.prefix}`
            );
        });
    }
}
