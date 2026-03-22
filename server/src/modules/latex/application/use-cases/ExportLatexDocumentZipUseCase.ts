import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import {
    createZipDownloadResponse,
    sanitizeDownloadName
} from '@shared/infrastructure/http/responses/download-response';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { sanitizeAssetPath } from '@modules/latex/application/utilities/sanitize-asset-path';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { ExportLatexDocumentInputDTO, ExportLatexDocumentOutputDTO } from '@modules/latex/application/dtos/ExportLatexDocumentDTO';
import type { IUseCase } from '@shared/application/IUseCase';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type { ILatexAssetRepository } from '@modules/latex/domain/port/ILatexAssetRepository';
import type { ILatexFileRepository } from '@modules/latex/domain/port/ILatexFileRepository';
import type { IStorageService } from '@shared/domain/port/IStorageService';

/**
 * Exports a LaTeX document as a `.zip` archive.
 *
 * Includes all LatexFile records (respecting their `path` prefix) plus
 * all associated assets fetched from object storage.
 */
@injectable()
export class ExportLatexDocumentZipUseCase implements IUseCase<ExportLatexDocumentInputDTO, ExportLatexDocumentOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository)
        private readonly latexDocumentRepository: ILatexDocumentRepository,

        @inject(LATEX_TOKENS.LatexAssetRepository)
        private readonly latexAssetRepository: ILatexAssetRepository,

        @inject(LATEX_TOKENS.LatexFileRepository)
        private readonly latexFileRepository: ILatexFileRepository,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
    ) {}

    async execute(input: ExportLatexDocumentInputDTO): Promise<Result<ExportLatexDocumentOutputDTO, ApplicationError>> {
        try {
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

            const [latexFiles, assets] = await Promise.all([
                this.latexFileRepository.findAllByDocument(input.documentId),
                this.latexAssetRepository.findAllByDocument(input.documentId)
            ]);

            const safeName = sanitizeDownloadName(document.props.title, 'document');

            if (latexFiles.length === 0) {
                return Result.fail(new ApplicationError(
                    ErrorCodes.LATEX_COMPILATION_FAILED,
                    'This document has no LaTeX files. Create main.tex before exporting.',
                    422
                ));
            }

            const output = createZipDownloadResponse({
                filename: safeName,
                cacheControl: 'no-cache',
                appendEntries: async (archive) => {
                    for (const file of latexFiles) {
                        archive.append(file.props.content, { name: file.fullPath });
                    }

                    for (const asset of assets) {
                        try {
                            const stream = await this.storageService.getStream(
                                SYS_BUCKETS.LATEX_ASSETS,
                                asset.props.storageKey
                            );
                            const entryName = sanitizeAssetPath(asset.props.path, asset.props.originalName);

                            archive.append(stream, { name: entryName });
                        } catch {
                            // Skip assets that cannot be retrieved from storage.
                        }
                    }
                }
            });

            return Result.ok(output);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to export LaTeX document as zip',
                500
            ));
        }
    }
};
