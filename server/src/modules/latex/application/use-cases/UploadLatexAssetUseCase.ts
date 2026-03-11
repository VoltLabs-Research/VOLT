import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import { v4 } from 'uuid';
import path from 'node:path';
import type { UploadLatexAssetInputDTO, UploadLatexAssetOutputDTO } from '@modules/latex/application/dtos/UploadLatexAssetDTO';
import type { IUseCase } from '@shared/application/IUseCase';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type { ILatexAssetRepository } from '@modules/latex/domain/port/ILatexAssetRepository';
import type { IStorageService } from '@shared/domain/port/IStorageService';

const MAX_ASSET_SIZE = 50 * 1024 * 1024;

/** Uploads a file asset for a LaTeX document, stores it in MinIO, and persists metadata. */
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
            if (!input.file || !input.file.buffer?.length) {
                return Result.fail(ApplicationError.badRequest(
                    ErrorCodes.FILE_READ_ERROR,
                    'No file provided or file is empty'
                ));
            }

            if (input.file.size > MAX_ASSET_SIZE) {
                return Result.fail(ApplicationError.badRequest(
                    ErrorCodes.FILE_READ_ERROR,
                    'File exceeds the 50MB asset size limit'
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

            const ext = path.extname(input.file.originalname);
            const storageKey = `latex-assets/${input.teamId}/${input.documentId}/${v4()}${ext}`;
            const mimetype = input.file.mimetype || 'application/octet-stream';

            await this.storageService.upload(
                SYS_BUCKETS.LATEX_ASSETS,
                storageKey,
                input.file.buffer,
                { 'Content-Type': mimetype }
            );

            const url = this.storageService.getPublicURL(SYS_BUCKETS.LATEX_ASSETS, storageKey);

            const asset = await this.latexAssetRepository.create({
                team: input.teamId,
                document: input.documentId,
                originalName: input.file.originalname,
                storageKey,
                url,
                mimetype,
                size: input.file.size,
                createdBy: input.userId,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            return Result.ok({
                _id: asset._id,
                documentId: asset.props.document,
                originalName: asset.props.originalName,
                url: asset.props.url,
                mimetype: asset.props.mimetype,
                size: asset.props.size,
                createdAt: asset.props.createdAt
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to upload LaTeX asset',
                500
            ));
        }
    }
};
