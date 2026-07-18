import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import type { CreateWhiteboardInputDTO, CreateWhiteboardOutputDTO } from '@modules/whiteboards/application/dtos/CreateWhiteboardDTO';
import type { DeleteWhiteboardInputDTO, DeleteWhiteboardOutputDTO } from '@modules/whiteboards/application/dtos/DeleteWhiteboardDTO';
import type { GetWhiteboardAssetInputDTO, GetWhiteboardAssetOutputDTO } from '@modules/whiteboards/application/dtos/GetWhiteboardAssetDTO';
import type { GetWhiteboardInputDTO, GetWhiteboardOutputDTO } from '@modules/whiteboards/application/dtos/GetWhiteboardDTO';
import type { GetWhiteboardStateInputDTO, GetWhiteboardStateOutputDTO } from '@modules/whiteboards/application/dtos/GetWhiteboardStateDTO';
import type { ListWhiteboardsInputDTO, ListWhiteboardsOutputDTO } from '@modules/whiteboards/application/dtos/ListWhiteboardsDTO';
import type { MoveWhiteboardInputDTO, MoveWhiteboardOutputDTO } from '@modules/whiteboards/application/dtos/MoveWhiteboardDTO';
import type { SaveWhiteboardStateInputDTO, SaveWhiteboardStateOutputDTO } from '@modules/whiteboards/application/dtos/SaveWhiteboardStateDTO';
import type { UpdateWhiteboardInputDTO, UpdateWhiteboardOutputDTO } from '@modules/whiteboards/application/dtos/UpdateWhiteboardDTO';
import type { UploadWhiteboardAssetInputDTO, UploadWhiteboardAssetOutputDTO } from '@modules/whiteboards/application/dtos/UploadWhiteboardAssetDTO';
import { CreateWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/CreateWhiteboardUseCase';
import { DeleteWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/DeleteWhiteboardUseCase';
import { GetWhiteboardStateUseCase } from '@modules/whiteboards/application/use-cases/GetWhiteboardStateUseCase';
import { GetWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/GetWhiteboardUseCase';
import { ListWhiteboardsUseCase } from '@modules/whiteboards/application/use-cases/ListWhiteboardsUseCase';
import { MoveWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/MoveWhiteboardUseCase';
import { UpdateWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/UpdateWhiteboardUseCase';
import { requireWhiteboardStorageClusterId, type WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';
import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';
import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IClusterObjectSignedUrlService, ITeamClusterObjectGatewayClient } from '@shared/contracts/ports';
import { CLUSTER_ACCESS_TOKENS } from '@shared/contracts/tokens/ClusterAccessTokens';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject } from 'tsyringe';
import { v4 as uuidv4 } from 'uuid';

/**
 * The single application service for the whiteboards module. Each method folds
 * the exact logic of a previously separate use case, converting the Result error
 * channel to thrown `ApplicationError`s so Express 5 forwards them to the global
 * error middleware. The `createWhiteboard`, `listWhiteboards`, `getWhiteboard`,
 * `updateWhiteboard`, `deleteWhiteboard`, `moveWhiteboard` and
 * `getWhiteboardState` methods delegate to their retained use cases — all still
 * consumed by whiteboard AI tools (and `DeleteWhiteboardUseCase` is additionally
 * consumed by the team-deleted event handler and the folder-delete use case).
 * The `saveWhiteboardState`, `uploadWhiteboardAsset` and `getWhiteboardAsset`
 * methods fold their (controller-only) use-case logic verbatim.
 */
@Singleton(WHITEBOARD_TOKENS.WhiteboardService)
export default class WhiteboardService {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository) private readonly whiteboardRepository: IWhiteboardRepository,
        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient) private readonly objectGatewayClient: ITeamClusterObjectGatewayClient,
        @inject(CLUSTER_ACCESS_TOKENS.ClusterObjectSignedUrlService) private readonly signedUrlService: IClusterObjectSignedUrlService,
        @inject(CreateWhiteboardUseCase) private readonly createWhiteboardUseCase: CreateWhiteboardUseCase,
        @inject(ListWhiteboardsUseCase) private readonly listWhiteboardsUseCase: ListWhiteboardsUseCase,
        @inject(GetWhiteboardUseCase) private readonly getWhiteboardUseCase: GetWhiteboardUseCase,
        @inject(UpdateWhiteboardUseCase) private readonly updateWhiteboardUseCase: UpdateWhiteboardUseCase,
        @inject(DeleteWhiteboardUseCase) private readonly deleteWhiteboardUseCase: DeleteWhiteboardUseCase,
        @inject(MoveWhiteboardUseCase) private readonly moveWhiteboardUseCase: MoveWhiteboardUseCase,
        @inject(GetWhiteboardStateUseCase) private readonly getWhiteboardStateUseCase: GetWhiteboardStateUseCase
    ) {}

    async createWhiteboard(input: CreateWhiteboardInputDTO): Promise<CreateWhiteboardOutputDTO> {
        return this.createWhiteboardUseCase.execute(input);
    }

    async listWhiteboards(input: ListWhiteboardsInputDTO): Promise<ListWhiteboardsOutputDTO> {
        return this.listWhiteboardsUseCase.execute(input);
    }

    async getWhiteboard(input: GetWhiteboardInputDTO): Promise<GetWhiteboardOutputDTO> {
        return this.getWhiteboardUseCase.execute(input);
    }

    async updateWhiteboard(input: UpdateWhiteboardInputDTO): Promise<UpdateWhiteboardOutputDTO> {
        return this.updateWhiteboardUseCase.execute(input);
    }

    async deleteWhiteboard(input: DeleteWhiteboardInputDTO): Promise<DeleteWhiteboardOutputDTO> {
        return this.deleteWhiteboardUseCase.execute(input);
    }

    async moveWhiteboard(input: MoveWhiteboardInputDTO): Promise<MoveWhiteboardOutputDTO> {
        return this.moveWhiteboardUseCase.execute(input);
    }

    async getWhiteboardState(input: GetWhiteboardStateInputDTO): Promise<GetWhiteboardStateOutputDTO> {
        return this.getWhiteboardStateUseCase.execute(input);
    }

    async saveWhiteboardState(input: SaveWhiteboardStateInputDTO): Promise<SaveWhiteboardStateOutputDTO> {
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

            if (!whiteboard.props.payloadKey) {
                throw ApplicationError.conflict(
                    'Whiteboard::PayloadKeyRequired',
                    `Whiteboard ${whiteboard._id} does not have a payload key assigned`
                );
            }

            const key = whiteboard.props.payloadKey;
            const storageClusterId = requireWhiteboardStorageClusterId(whiteboard._id, whiteboard.props);

            await this.objectGatewayClient.putBuffer(storageClusterId, {
                bucket: TEAM_CLUSTER_BUCKETS.WHITEBOARDS,
                objectKey: key,
                buffer: input.stateBuffer,
                contentLength: input.stateBuffer.byteLength,
                contentType: 'application/json'
            });

            const updates: Partial<WhiteboardProps> = {
                lastEditedBy: input.userId
            };

            await this.whiteboardRepository.updateById(input.whiteboardId, updates);

            return null;
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to save whiteboard state',
                500
            );
        }
    }

    async uploadWhiteboardAsset(input: UploadWhiteboardAssetInputDTO): Promise<UploadWhiteboardAssetOutputDTO> {
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

            const assetId = uuidv4();
            const objectKey = `${input.teamId}/${input.whiteboardId}/assets/${assetId}`;
            const storageClusterId = requireWhiteboardStorageClusterId(whiteboard._id, whiteboard.props);
            const signed = this.signedUrlService.createToken({
                kind: 'cluster-object',
                operation: 'write',
                teamId: input.teamId,
                userId: input.userId,
                ownerClusterId: storageClusterId,
                bucket: TEAM_CLUSTER_BUCKETS.WHITEBOARDS,
                objectKey,
                resourceKind: 'whiteboard',
                resourceId: input.whiteboardId,
                contentLength: input.size,
                contentType: input.type || 'application/octet-stream'
            });

            return {
                assetId,
                uploadUrl: signed.url,
                expiresAt: signed.expiresAt
            };
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to upload whiteboard asset',
                500
            );
        }
    }

    async getWhiteboardAsset(input: GetWhiteboardAssetInputDTO): Promise<GetWhiteboardAssetOutputDTO> {
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

            const objectKey = `${input.teamId}/${input.whiteboardId}/assets/${input.assetId}`;
            const storageClusterId = requireWhiteboardStorageClusterId(whiteboard._id, whiteboard.props);
            const response = await this.objectGatewayClient.getStream(storageClusterId, TEAM_CLUSTER_BUCKETS.WHITEBOARDS, objectKey);

            return {
                stream: response.stream,
                mimetype: response.contentType
            };
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to get whiteboard asset',
                500
            );
        }
    }
}
