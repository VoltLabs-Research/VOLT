import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import type { ExportLatexDocumentInputDTO, ExportLatexDocumentOutputDTO } from '@modules/latex/application/dtos/ExportLatexDocumentDTO';
import { sanitizeAssetPath } from '@modules/latex/application/utilities/sanitize-asset-path';
import LatexAssetRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexAssetRepository';
import LatexDocumentRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexDocumentRepository';
import LatexFileRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexFileRepository';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import type { IStorageService } from '@shared/domain/port/IStorageService';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import {
    createZipDownloadResponse,
    sanitizeDownloadName
} from '@shared/infrastructure/http/responses/download-response';
import { inject } from 'tsyringe';

/**
 * Exports a LaTeX document as a `.zip` archive.
 *
 * Includes all LatexFile records (respecting their `path` prefix) plus
 * all associated assets fetched from object storage.
 */
@Singleton()
export class ExportLatexDocumentZipUseCase implements IUseCase<ExportLatexDocumentInputDTO, ExportLatexDocumentOutputDTO, ApplicationError> {
    constructor(
        
        private readonly latexDocumentRepository: LatexDocumentRepository,

        
        private readonly latexAssetRepository: LatexAssetRepository,

        
        private readonly latexFileRepository: LatexFileRepository,

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
