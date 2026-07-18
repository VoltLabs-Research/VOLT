import type { ILatexAssetRepository } from '@modules/latex/ports/ILatexAssetRepository';
import type { ILatexFileRepository } from '@modules/latex/ports/ILatexFileRepository';
import { LATEX_TOKENS } from '@modules/latex/di/LatexTokens';
import type { ILatexDocumentRepository } from '@modules/latex/ports/ILatexDocumentRepository';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import { CLUSTER_ACCESS_TOKENS } from '@shared/contracts/tokens/ClusterAccessTokens';
import type { IClusterObjectArchiveService } from '@shared/contracts/ports';
import type { ExportLatexDocumentInputDTO, ExportLatexDocumentOutputDTO } from '@modules/latex/dtos/ExportLatexDocumentDTO';
import { requireLatexStorageClusterId } from '@modules/latex/utilities/latex-storage';
import { sanitizeAssetPath } from '@modules/latex/utilities/sanitize-asset-path';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';
import { sanitizeDownloadName } from '@shared/infrastructure/http/responses/download-response';
import { v4 } from 'uuid';

/**
 * Exports a LaTeX document as a `.zip` archive.
 *
 * Includes all LatexFile records (respecting their `path` prefix) plus
 * all associated assets fetched from object storage.
 */
@Singleton()
export class ExportLatexDocumentZipUseCase implements IUseCase<ExportLatexDocumentInputDTO, ExportLatexDocumentOutputDTO> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository) private readonly latexDocumentRepository: ILatexDocumentRepository,
        @inject(LATEX_TOKENS.LatexAssetRepository) private readonly latexAssetRepository: ILatexAssetRepository,
        @inject(LATEX_TOKENS.LatexFileRepository) private readonly latexFileRepository: ILatexFileRepository,
        @inject(CLUSTER_ACCESS_TOKENS.ClusterObjectArchiveService) private readonly archiveService: IClusterObjectArchiveService
    ) {}

    async execute(input: ExportLatexDocumentInputDTO): Promise<ExportLatexDocumentOutputDTO> {
        const document = await this.latexDocumentRepository.findByTeamAndDocumentId(
            input.teamId,
            input.documentId
        );

        if (!document) {
            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'LaTeX document not found'
            );
        }
        const storageClusterId = requireLatexStorageClusterId(document._id, document.props);

        const [latexFiles, assets] = await Promise.all([
            this.latexFileRepository.findAllByDocument(input.documentId),
            this.latexAssetRepository.findAllByDocument(input.documentId)
        ]);

        const safeName = sanitizeDownloadName(document.props.title, 'document');

        if (latexFiles.length === 0) {
            throw new ApplicationError(
                ErrorCodes.LATEX_COMPILATION_FAILED,
                'This document has no LaTeX files. Create main.tex before exporting.',
                422
            );
        }

        return this.archiveService.createArchiveDownload({
            teamClusterId: storageClusterId,
            outputBucket: TEAM_CLUSTER_BUCKETS.TRAJECTORIES,
            outputObjectKey: `exports/latex/${input.documentId}/${v4()}.zip`,
            filename: `${safeName}.zip`,
            cacheControl: 'no-cache',
            entries: [
                ...latexFiles.map((file) => ({
                    type: 'inline' as const,
                    name: file.fullPath,
                    content: file.props.content
                })),
                ...assets.map((asset) => ({
                    type: 'object' as const,
                    ownerClusterId: storageClusterId,
                    bucket: TEAM_CLUSTER_BUCKETS.LATEX_ASSETS,
                    objectKey: asset.props.storageKey,
                    name: sanitizeAssetPath(asset.props.path, asset.props.originalName),
                    optional: true
                }))
            ]
        });
    }
}
