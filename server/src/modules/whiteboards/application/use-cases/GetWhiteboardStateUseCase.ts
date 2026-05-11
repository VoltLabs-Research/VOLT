import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import type { GetWhiteboardStateInputDTO, GetWhiteboardStateOutputDTO } from '@modules/whiteboards/application/dtos/GetWhiteboardStateDTO';
import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';
import WhiteboardRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { Readable } from 'node:stream';

/** Empty scene returned for whiteboards that have never been saved. */
const EMPTY_SCENE_JSON = JSON.stringify({ revision: 0, elements: [], appState: {} });

@Singleton()
export class GetWhiteboardStateUseCase implements IUseCase<GetWhiteboardStateInputDTO, GetWhiteboardStateOutputDTO, ApplicationError> {
    constructor(
        private readonly whiteboardRepository: WhiteboardRepository,
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient
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

    async execute(input: GetWhiteboardStateInputDTO): Promise<Result<GetWhiteboardStateOutputDTO, ApplicationError>> {
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

            if (!whiteboard.props.payloadKey) {
                return Result.fail(ApplicationError.conflict(
                    'Whiteboard::PayloadKeyRequired',
                    `Whiteboard ${whiteboard._id} does not have a payload key assigned`
                ));
            }

            const storageClusterId = this.requireStorageClusterId(whiteboard._id, whiteboard.props);
            const key = whiteboard.props.payloadKey;
            const stateExists = await this.objectGatewayClient.exists(storageClusterId, TEAM_CLUSTER_BUCKETS.WHITEBOARDS, key);

            if (!stateExists) {
                const stream = Readable.from(Buffer.from(EMPTY_SCENE_JSON));
                return Result.ok({ stream });
            }

            const response = await this.objectGatewayClient.getStream(storageClusterId, TEAM_CLUSTER_BUCKETS.WHITEBOARDS, key);
            return Result.ok({ stream: response.stream });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to load whiteboard state',
                500
            ));
        }
    }
}
