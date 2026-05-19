import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import ClusterObjectSignedUrlService from '@modules/cluster/infrastructure/services/ClusterObjectSignedUrlService';
import { buildLatexAssetContentUrl, buildLatexAssetStorageKey, requireLatexStorageClusterId } from '@modules/latex/application/utilities/latex-storage';
import type { LatexAssetUploadTargetDTO } from '@modules/latex/application/dtos/UploadLatexAssetDTO';
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
 * Creates direct object upload targets for one or more LaTeX assets and persists
 * their metadata. The client uploads file bytes with the returned signed URLs.
 */
@Singleton()
export class UploadLatexAssetUseCase implements IUseCase<UploadLatexAssetInputDTO, UploadLatexAssetOutputDTO, ApplicationError> {
    constructor(
        private readonly latexDocumentRepository: LatexDocumentRepository,
        private readonly latexAssetRepository: LatexAssetRepository,
        private readonly signedUrlService: ClusterObjectSignedUrlService
    ) {}

    async execute(input: UploadLatexAssetInputDTO): Promise<Result<UploadLatexAssetOutputDTO, ApplicationError>> {
        try {
            const validFiles = (input.files ?? [])
                .map((file, uploadIndex) => ({ file, uploadIndex }))
                .filter(({ file }) => file && file.name && file.size > 0);

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

            const uploaded: LatexAssetUploadTargetDTO[] = [];
            let failedCount = 0;

            for (const { file, uploadIndex } of validFiles) {
                if (file.size > MAX_ASSET_SIZE) {
                    failedCount++;
                    continue;
                }

                try {
                    const ext = path.extname(file.name);
                    const storageKey = buildLatexAssetStorageKey(input.teamId, input.documentId, v4(), ext);
                    const mimetype = file.type || 'application/octet-stream';

                    const assetPath = sanitizeAssetPath(input.path ?? file.name, file.name);

                    const url = buildLatexAssetContentUrl(input.teamId, input.documentId, storageKey);

                    const asset = await this.latexAssetRepository.create({
                        team: input.teamId,
                        document: input.documentId,
                        originalName: file.name,
                        path: assetPath,
                        storageKey,
                        url,
                        mimetype,
                        size: file.size,
                        createdBy: input.userId,
                        createdAt: new Date(),
                        updatedAt: new Date()
                    });
                    const signed = this.signedUrlService.createToken({
                        kind: 'cluster-object',
                        operation: 'write',
                        teamId: input.teamId,
                        userId: input.userId,
                        ownerClusterId: storageClusterId,
                        bucket: TEAM_CLUSTER_BUCKETS.LATEX_ASSETS,
                        objectKey: storageKey,
                        resourceKind: 'latex-asset',
                        resourceId: asset._id,
                        contentLength: file.size,
                        contentType: mimetype
                    });

                    uploaded.push({
                        _id: asset._id,
                        uploadIndex,
                        documentId: asset.props.document,
                        originalName: asset.props.originalName,
                        path: asset.props.path,
                        url: buildLatexAssetContentUrl(input.teamId, input.documentId, asset.props.storageKey),
                        mimetype: asset.props.mimetype,
                        size: asset.props.size,
                        createdAt: asset.props.createdAt,
                        uploadUrl: signed.url,
                        expiresAt: signed.expiresAt
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
