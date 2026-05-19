import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import ClusterObjectSignedUrlService from '@modules/cluster/infrastructure/services/ClusterObjectSignedUrlService';
import type { UploadWhiteboardAssetInputDTO, UploadWhiteboardAssetOutputDTO } from '@modules/whiteboards/application/dtos/UploadWhiteboardAssetDTO';
import type { WhiteboardProps } from '@modules/whiteboards/domain/entities/Whiteboard';
import WhiteboardRepository from '@modules/whiteboards/infrastructure/persistence/mongo/repositories/WhiteboardRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { v4 as uuidv4 } from 'uuid';

@Singleton()
export class UploadWhiteboardAssetUseCase implements IUseCase<UploadWhiteboardAssetInputDTO, UploadWhiteboardAssetOutputDTO, ApplicationError> {
    constructor(
        private readonly whiteboardRepository: WhiteboardRepository,
        private readonly signedUrlService: ClusterObjectSignedUrlService
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

    async execute(input: UploadWhiteboardAssetInputDTO): Promise<Result<UploadWhiteboardAssetOutputDTO, ApplicationError>> {
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

            const assetId = uuidv4();
            const objectKey = `${input.teamId}/${input.whiteboardId}/assets/${assetId}`;
            const storageClusterId = this.requireStorageClusterId(whiteboard._id, whiteboard.props);
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

            return Result.ok({
                assetId,
                uploadUrl: signed.url,
                expiresAt: signed.expiresAt
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to upload whiteboard asset',
                500
            ));
        }
    }
}
