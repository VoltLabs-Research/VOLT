import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import { inject, injectable } from 'tsyringe';
import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import type TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import type { DeleteWhiteboardInputDTO, DeleteWhiteboardOutputDTO } from '@modules/whiteboards/application/dtos/DeleteWhiteboardDTO';
import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';
import WhiteboardDeletedEvent from '@modules/whiteboards/domain/events/WhiteboardDeletedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';

@Singleton()
export class DeleteWhiteboardUseCase implements IUseCase<DeleteWhiteboardInputDTO, DeleteWhiteboardOutputDTO, ApplicationError> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository) private readonly whiteboardRepository: IWhiteboardRepository,
        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient) private readonly objectGatewayClient: TeamClusterObjectGatewayClient,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    private requireStorageClusterId(whiteboardId: string, props: WhiteboardProps): string {
        if (props.storageClusterId && props.storageClusterId.trim().length > 0) {
            return props.storageClusterId;
        }

        throw ApplicationError.conflict(
            'Whiteboard::StorageClusterRequired',
            `Whiteboard ${whiteboardId} does not have a storage cluster assigned`
        );
    }

    async execute(input: DeleteWhiteboardInputDTO): Promise<Result<DeleteWhiteboardOutputDTO, ApplicationError>> {
        try {
            if (!input.userId) {
                return Result.fail(ApplicationError.unauthorized(
                    ErrorCodes.AUTHENTICATION_REQUIRED,
                    'Authentication required'
                ));
            }

            const whiteboard = await this.whiteboardRepository.findByTeamAndWhiteboardId(
                input.teamId,
                input.whiteboardId
            );

            if (!whiteboard) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'Whiteboard not found'
                ));
            }

            await this.whiteboardRepository.deleteById(input.whiteboardId);

            const prefix = `${input.teamId}/${input.whiteboardId}/`;
            const storageClusterId = this.requireStorageClusterId(whiteboard._id, whiteboard.props);
            try {
                await this.objectGatewayClient.deleteByPrefix(storageClusterId, TEAM_CLUSTER_BUCKETS.WHITEBOARDS, prefix);
            } catch {
                // Storage cleanup is best-effort
            }

            await this.eventBus.publish(new WhiteboardDeletedEvent({
                whiteboardId: input.whiteboardId,
                teamId: input.teamId,
                userId: input.userId,
                whiteboardTitle: whiteboard.props.title ?? ''
            }));

            return Result.ok(null);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to delete whiteboard',
                500
            ));
        }
    }
}
