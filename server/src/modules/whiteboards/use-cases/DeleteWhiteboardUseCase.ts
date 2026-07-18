import { WHITEBOARD_TOKENS } from '@modules/whiteboards/di/WhiteboardTokens';
import { inject } from 'tsyringe';
import type { IWhiteboardRepository } from '@modules/whiteboards/ports/IWhiteboardRepository';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import type { ITeamClusterObjectGatewayClient } from '@shared/contracts/ports';
import type { DeleteWhiteboardInputDTO, DeleteWhiteboardOutputDTO } from '@modules/whiteboards/dtos/DeleteWhiteboardDTO';
import { requireWhiteboardStorageClusterId } from '@modules/whiteboards/entities/Whiteboard';
import WhiteboardDeletedEvent from '@modules/whiteboards/events/WhiteboardDeletedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';

@Singleton()
export class DeleteWhiteboardUseCase implements IUseCase<DeleteWhiteboardInputDTO, DeleteWhiteboardOutputDTO> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository) private readonly whiteboardRepository: IWhiteboardRepository,
        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient) private readonly objectGatewayClient: ITeamClusterObjectGatewayClient,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(input: DeleteWhiteboardInputDTO): Promise<DeleteWhiteboardOutputDTO> {
        try {
            const whiteboard = await this.whiteboardRepository.findByTeamAndWhiteboardId(
                input.teamId,
                input.whiteboardId
            );

            if (!whiteboard) {
                throw ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'Whiteboard not found'
                );
            }

            await this.whiteboardRepository.deleteById(input.whiteboardId);

            const prefix = `${input.teamId}/${input.whiteboardId}/`;
            const storageClusterId = requireWhiteboardStorageClusterId(whiteboard._id, whiteboard.props);
            try {
                await this.objectGatewayClient.deleteByPrefix(storageClusterId, TEAM_CLUSTER_BUCKETS.WHITEBOARDS, prefix);
            } catch {
            }

            await this.eventBus.publish(new WhiteboardDeletedEvent({
                whiteboardId: input.whiteboardId,
                teamId: input.teamId,
                userId: input.userId,
                whiteboardTitle: whiteboard.props.title ?? ''
            }));

            return null;
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to delete whiteboard',
                500
            );
        }
    }
}
