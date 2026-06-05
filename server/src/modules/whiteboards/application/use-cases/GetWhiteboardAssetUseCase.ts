import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { WHITEBOARD_TOKENS } from '@modules/whiteboards/infrastructure/di/WhiteboardTokens';
import type { IWhiteboardRepository } from '@modules/whiteboards/domain/port/IWhiteboardRepository';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import type TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import type { GetWhiteboardAssetInputDTO, GetWhiteboardAssetOutputDTO } from '@modules/whiteboards/application/dtos/GetWhiteboardAssetDTO';
import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class GetWhiteboardAssetUseCase implements IUseCase<GetWhiteboardAssetInputDTO, GetWhiteboardAssetOutputDTO, ApplicationError> {
    constructor(
        @inject(WHITEBOARD_TOKENS.WhiteboardRepository) private readonly whiteboardRepository: IWhiteboardRepository,
        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient) private readonly objectGatewayClient: TeamClusterObjectGatewayClient
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

    async execute(input: GetWhiteboardAssetInputDTO): Promise<Result<GetWhiteboardAssetOutputDTO, ApplicationError>> {
        try {
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

            const objectKey = `${input.teamId}/${input.whiteboardId}/assets/${input.assetId}`;
            const storageClusterId = this.requireStorageClusterId(whiteboard._id, whiteboard.props);
            const response = await this.objectGatewayClient.getStream(storageClusterId, TEAM_CLUSTER_BUCKETS.WHITEBOARDS, objectKey);

            return Result.ok({
                stream: response.stream,
                mimetype: response.contentType
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to get whiteboard asset',
                500
            ));
        }
    }
}
