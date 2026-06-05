import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type TrajectoryUploadSessionRepository from '@modules/trajectory/infrastructure/persistence/mongo/repositories/trajectory/TrajectoryUploadSessionRepository';
import { inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import type { ITrajectoryRepository } from '@modules/trajectory/domain/port/trajectory/ITrajectoryRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import logger from '@shared/infrastructure/logger';
import { injectable } from 'tsyringe';

import type { CancelTrajectoryUploadSessionInputDTO } from '@modules/trajectory/application/dtos/trajectory/TrajectoryUploadSessionDTO';

@injectable()
export default class CancelTrajectoryUploadSessionUseCase implements IUseCase<
    CancelTrajectoryUploadSessionInputDTO,
    void,
    ApplicationError
> {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryUploadSessionRepository) private readonly uploadSessionRepository: TrajectoryUploadSessionRepository,
        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient) private readonly objectGatewayClient: TeamClusterObjectGatewayClient,
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository) private readonly trajectoryRepo: ITrajectoryRepository
    ) {}

    async execute(input: CancelTrajectoryUploadSessionInputDTO): Promise<Result<void, ApplicationError>> {
        const session = await this.uploadSessionRepository.findById(input.uploadSessionId);
        if (!session) {
            return Result.fail(ApplicationError.notFound(
                'TrajectoryUploadSession::NotFound',
                'Upload session not found'
            ));
        }

        if (session.team.toString() !== input.teamId || session.user.toString() !== input.userId) {
            return Result.fail(ApplicationError.forbidden(
                'TrajectoryUploadSession::Forbidden',
                'Upload session does not belong to this user and team'
            ));
        }

        if (session.status === 'committed') {
            return Result.fail(ApplicationError.conflict(
                'TrajectoryUploadSession::AlreadyCommitted',
                'Committed upload sessions cannot be cancelled'
            ));
        }

        const ownerClusterId = session.ownerClusterId.toString();
        await Promise.all(session.files.flatMap((file) => [
            this.objectGatewayClient.deleteObject(ownerClusterId, session.bucket, file.finalObjectKey).catch((error) => {
                logger.debug(error, `[CancelTrajectoryUploadSessionUseCase] Failed to delete ${file.finalObjectKey}`);
            }),
            ...file.parts.map((part) =>
                this.objectGatewayClient.deleteObject(ownerClusterId, session.bucket, part.objectKey).catch((error) => {
                    logger.debug(error, `[CancelTrajectoryUploadSessionUseCase] Failed to delete ${part.objectKey}`);
                })
            )
        ]));

        await this.uploadSessionRepository.markStatus(session.id, 'cancelled');
        await this.trajectoryRepo.updateById(session.resourceId.toString(), { status: TrajectoryStatus.Failed }).catch(() => {});

        return Result.ok(undefined);
    }
}
