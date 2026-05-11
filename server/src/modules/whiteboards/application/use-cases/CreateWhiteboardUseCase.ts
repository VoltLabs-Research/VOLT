import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import type { CreateWhiteboardInputDTO, CreateWhiteboardOutputDTO } from '@modules/whiteboards/application/dtos/CreateWhiteboardDTO';
import Whiteboard from '@modules/whiteboards/domain/entities/Whiteboard';
import WhiteboardCreatedEvent from '@modules/whiteboards/domain/events/WhiteboardCreatedEvent';
import WhiteboardFolderRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardFolderRepository';
import WhiteboardRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardRepository';
import type { IUseCase } from '@shared/application/IUseCase';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject } from 'tsyringe';

const EMPTY_STATE = Buffer.from(JSON.stringify({ revision: 0, elements: [], appState: {} }));

@Singleton()
export class CreateWhiteboardUseCase implements IUseCase<CreateWhiteboardInputDTO, CreateWhiteboardOutputDTO, ApplicationError> {
    constructor(
        private readonly whiteboardRepository: WhiteboardRepository,
        private readonly whiteboardFolderRepository: WhiteboardFolderRepository,
        private readonly teamClusterSelectionService: TeamClusterSelectionService,
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(input: CreateWhiteboardInputDTO): Promise<Result<CreateWhiteboardOutputDTO, ApplicationError>> {
        try {
            if (input.folderId) {
                const folder = await this.whiteboardFolderRepository.findByTeamAndFolderId(
                    input.teamId,
                    input.folderId
                );

                if (!folder) {
                    return Result.fail(ApplicationError.notFound(
                        ErrorCodes.RESOURCE_NOT_FOUND,
                        'Target whiteboard folder not found'
                    ));
                }
            }

            const storageClusterId = await this.teamClusterSelectionService.resolveStorageClusterId(input.teamId);

            const whiteboard = await this.whiteboardRepository.create({
                team: input.teamId,
                createdBy: input.userId,
                lastEditedBy: input.userId,
                title: input.title,
                folder: input.folderId ?? null,
                storageClusterId,
                payloadKey: '',
                createdAt: new Date(),
                updatedAt: new Date()
            });

            const payloadKey = `${input.teamId}/${whiteboard._id}/state.json`;

            await this.objectGatewayClient.putBuffer(storageClusterId, {
                bucket: TEAM_CLUSTER_BUCKETS.WHITEBOARDS,
                objectKey: payloadKey,
                buffer: EMPTY_STATE,
                contentLength: EMPTY_STATE.byteLength,
                contentType: 'application/json'
            });

            const updated = await this.whiteboardRepository.updateById(whiteboard._id, {
                payloadKey
            } as Partial<Whiteboard['props']>);

            const finalWhiteboard = updated ?? whiteboard;

            await this.eventBus.publish(new WhiteboardCreatedEvent({
                whiteboardId: finalWhiteboard._id,
                teamId: input.teamId,
                userId: input.userId,
                whiteboardTitle: finalWhiteboard.props.title ?? ''
            }));

            return Result.ok({
                _id: finalWhiteboard._id,
                title: finalWhiteboard.props.title,
                folder: finalWhiteboard.props.folder,
                payloadKey,
                createdAt: finalWhiteboard.props.createdAt,
                updatedAt: finalWhiteboard.props.updatedAt
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to create whiteboard',
                500
            ));
        }
    }
}
