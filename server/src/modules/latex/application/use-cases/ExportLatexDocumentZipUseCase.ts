import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import {
    createZipDownloadResponse,
    sanitizeDownloadName
} from '@shared/infrastructure/http/responses/download-response';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { ExportLatexDocumentInputDTO, ExportLatexDocumentOutputDTO } from '@modules/latex/application/dtos/ExportLatexDocumentDTO';
import type { IUseCase } from '@shared/application/IUseCase';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type { ILatexAssetRepository } from '@modules/latex/domain/port/ILatexAssetRepository';
import type { IStorageService } from '@shared/domain/port/IStorageService';

/**
 * Exports a LaTeX document as a `.zip` archive containing `main.tex`
 * and all associated assets fetched from object storage.
 */
@injectable()
export class ExportLatexDocumentZipUseCase implements IUseCase<ExportLatexDocumentInputDTO, ExportLatexDocumentOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository)
        private readonly latexDocumentRepository: ILatexDocumentRepository,

        @inject(LATEX_TOKENS.LatexAssetRepository)
        private readonly latexAssetRepository: ILatexAssetRepository,

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

            const assets = await this.latexAssetRepository.findAllByDocument(input.documentId);
            const safeName = sanitizeDownloadName(document.props.title, 'document');
            const content = document.props.content ?? '';

            const output = createZipDownloadResponse({
                filename: safeName,
                cacheControl: 'no-cache',
                appendEntries: async (archive) => {
                    archive.append(content, { name: 'main.tex' });

                    for (const asset of assets) {
                        try {
                            const stream = await this.storageService.getStream(
                                SYS_BUCKETS.LATEX_ASSETS,
                                asset.props.storageKey
                            );
                            archive.append(stream, { name: `assets/${asset.props.originalName}` });
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
