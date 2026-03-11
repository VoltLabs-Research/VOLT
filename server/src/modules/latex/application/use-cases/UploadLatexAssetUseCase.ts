import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { sanitizeAssetPath } from '@modules/latex/application/utilities/sanitize-asset-path';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import { v4 } from 'uuid';
import path from 'node:path';
import type { UploadLatexAssetInputDTO, UploadLatexAssetOutputDTO } from '@modules/latex/application/dtos/UploadLatexAssetDTO';
import type { IUseCase } from '@shared/application/IUseCase';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type { ILatexAssetRepository } from '@modules/latex/domain/port/ILatexAssetRepository';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import type { LatexAssetDTO } from '@modules/latex/application/dtos/LatexAssetDTO';

const MAX_ASSET_SIZE = 50 * 1024 * 1024;

/**
 * Uploads one or more file assets for a LaTeX document, stores them in MinIO,
 * and persists metadata. Returns the list of successfully uploaded assets along
 * with a count of any files that could not be processed.
 */
@injectable()
export class UploadLatexAssetUseCase implements IUseCase<UploadLatexAssetInputDTO, UploadLatexAssetOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository)
        private readonly latexDocumentRepository: ILatexDocumentRepository,

        @inject(LATEX_TOKENS.LatexAssetRepository)
        private readonly latexAssetRepository: ILatexAssetRepository,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
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

            const uploaded: LatexAssetDTO[] = [];
            let failedCount = 0;

            for (const file of validFiles) {
                if (file.size > MAX_ASSET_SIZE) {
                    failedCount++;
                    continue;
                }

                try {
                    const ext = path.extname(file.originalname);
                    const storageKey = `latex-assets/${input.teamId}/${input.documentId}/${v4()}${ext}`;
                    const mimetype = file.mimetype || 'application/octet-stream';

                    const assetPath = input.path
                        ? sanitizeAssetPath(input.path, file.originalname)
                        : undefined;

                    await this.storageService.upload(
                        SYS_BUCKETS.LATEX_ASSETS,
                        storageKey,
                        file.buffer,
                        { 'Content-Type': mimetype }
                    );

                    const url = this.storageService.getPublicURL(SYS_BUCKETS.LATEX_ASSETS, storageKey);

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
                        url: asset.props.url,
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
};
