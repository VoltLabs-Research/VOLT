import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import { buildLatexAssetContentUrl, buildLatexAssetStorageKey, requireLatexStorageClusterId } from '@modules/latex/application/utilities/latex-storage';
import type { LatexAssetDTO } from '@modules/latex/application/dtos/LatexAssetDTO';
import type { UploadLatexAssetInputDTO, UploadLatexAssetOutputDTO } from '@modules/latex/application/dtos/UploadLatexAssetDTO';
import { sanitizeAssetPath } from '@modules/latex/application/utilities/sanitize-asset-path';
import LatexAssetRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexAssetRepository';
import LatexDocumentRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexDocumentRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import path from 'node:path';
import { v4 } from 'uuid';

const MAX_ASSET_SIZE = 50 * 1024 * 1024;

/**
 * Uploads one or more file assets for a LaTeX document, stores them in MinIO,
 * and persists metadata. Returns the list of successfully uploaded assets along
 * with a count of any files that could not be processed.
 */
@Singleton()
export class UploadLatexAssetUseCase implements IUseCase<UploadLatexAssetInputDTO, UploadLatexAssetOutputDTO, ApplicationError> {
    constructor(
        private readonly latexDocumentRepository: LatexDocumentRepository,
        private readonly latexAssetRepository: LatexAssetRepository,
        private readonly objectGatewayClient: TeamClusterObjectGatewayClient
    ) {}

    async execute(input: UploadLatexAssetInputDTO): Promise<Result<UploadLatexAssetOutputDTO, ApplicationError>> {
        try {
            const validFiles = (input.files ?? []).filter(
                (f) => f && f.buffer?.length
            );

            if (validFiles.length === 0) {
                return Result.fail(ApplicationError.badRequest(
                    ErrorCodes.FILE_READ_ERROR,
                    'No valid files provided'
                ));
            }

            const document = await this.latexDocumentRepository.findByTeamAndDocumentId(
                input.teamId,
                input.documentId
            );

            if (!document) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'LaTeX document not found'
                ));
            }
            const storageClusterId = requireLatexStorageClusterId(document._id, document.props);

            const uploaded: LatexAssetDTO[] = [];
            let failedCount = 0;

            for (const file of validFiles) {
                if (file.size > MAX_ASSET_SIZE) {
                    failedCount++;
                    continue;
                }

                try {
                    const ext = path.extname(file.originalname);
                    const storageKey = buildLatexAssetStorageKey(input.teamId, input.documentId, v4(), ext);
                    const mimetype = file.mimetype || 'application/octet-stream';

                    const assetPath = sanitizeAssetPath(input.path ?? file.originalname, file.originalname);

                    await this.objectGatewayClient.putBuffer(storageClusterId, {
                        bucket: TEAM_CLUSTER_BUCKETS.LATEX_ASSETS,
                        objectKey: storageKey,
                        buffer: file.buffer,
                        contentLength: file.buffer.byteLength,
                        contentType: mimetype
                    });

                    const url = buildLatexAssetContentUrl(input.teamId, input.documentId, storageKey);

                    const asset = await this.latexAssetRepository.create({
                        team: input.teamId,
                        document: input.documentId,
                        originalName: file.originalname,
                        path: assetPath,
                        storageKey,
                        url,
                        mimetype,
                        size: file.size,
                        createdBy: input.userId,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });

                    uploaded.push({
                        _id: asset._id,
                        documentId: asset.props.document,
                        originalName: asset.props.originalName,
                        path: asset.props.path,
                        url: buildLatexAssetContentUrl(input.teamId, input.documentId, asset.props.storageKey),
                        mimetype: asset.props.mimetype,
                        size: asset.props.size,
                        createdAt: asset.props.createdAt
                    });
                } catch {
                    failedCount++;
                }
            }

            return Result.ok({
                uploaded,
                failedCount,
                total: validFiles.length
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to upload LaTeX assets',
                500
            ));
        }
    }
}
