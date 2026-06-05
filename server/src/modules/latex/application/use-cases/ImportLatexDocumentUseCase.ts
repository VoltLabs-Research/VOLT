import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { ILatexAssetRepository } from '@modules/latex/domain/port/ILatexAssetRepository';
import type { ILatexFolderRepository } from '@modules/latex/domain/port/ILatexFolderRepository';
import type { ILatexFileRepository } from '@modules/latex/domain/port/ILatexFileRepository';
import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import type TeamClusterObjectGatewayClient from '@modules/cluster/infrastructure/services/TeamClusterObjectGatewayClient';
import type { ITeamClusterSelectionService } from '@modules/container/domain/port/ITeamClusterSelectionService';
import type { ImportLatexDocumentInputDTO, ImportLatexDocumentOutputDTO } from '@modules/latex/application/dtos/ImportLatexDocumentDTO';
import { buildLatexAssetContentUrl, buildLatexAssetStorageKey } from '@modules/latex/application/utilities/latex-storage';
import { sanitizeAssetPath } from '@modules/latex/application/utilities/sanitize-asset-path';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';
import path from 'node:path';
import unzipper from 'unzipper';
import { v4 } from 'uuid';

const MAX_IMPORT_SIZE = 100 * 1024 * 1024;
const MAIN_TEX_FILENAME = 'main.tex';

/**
 * Imports a `.tex`, `.zip`, or `.pdf` file and creates a new LaTeX document.
 *
 * - `.tex`: the file content becomes `main.tex` (entrypoint LatexFile).
 * - `.zip`: `main.tex` becomes the entrypoint; other `.tex` files become
 *   additional LatexFile records; non-tex files are uploaded as assets.
 * - `.pdf`: the PDF is stored as a LatexAsset and a `main.tex` wrapping it
 *   via `\usepackage{pdfpages}` + `\includepdf[pages=-]{...}` is created.
 */
@Singleton()
export class ImportLatexDocumentUseCase implements IUseCase<ImportLatexDocumentInputDTO, ImportLatexDocumentOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository) private readonly latexDocumentRepository: ILatexDocumentRepository,
        @inject(LATEX_TOKENS.LatexFolderRepository) private readonly latexFolderRepository: ILatexFolderRepository,
        @inject(LATEX_TOKENS.LatexAssetRepository) private readonly latexAssetRepository: ILatexAssetRepository,
        @inject(LATEX_TOKENS.LatexFileRepository) private readonly latexFileRepository: ILatexFileRepository,
        @inject(CONTAINER_TOKENS.TeamClusterSelectionService) private readonly teamClusterSelectionService: ITeamClusterSelectionService,
        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient) private readonly objectGatewayClient: TeamClusterObjectGatewayClient
    ) {}

    async execute(input: ImportLatexDocumentInputDTO): Promise<Result<ImportLatexDocumentOutputDTO, ApplicationError>> {
        try {
            if (!input.file?.buffer?.length) {
                return Result.fail(ApplicationError.badRequest(
                    ErrorCodes.FILE_READ_ERROR,
                    'No file provided or file is empty'
                ));
            }

            if (input.file.size > MAX_IMPORT_SIZE) {
                return Result.fail(ApplicationError.badRequest(
                    ErrorCodes.FILE_READ_ERROR,
                    'File exceeds the 100MB import size limit'
                ));
            }

            if (input.folderId) {
                const folder = await this.latexFolderRepository.findByTeamAndFolderId(
                    input.teamId,
                    input.folderId
                );

                if (!folder) {
                    return Result.fail(ApplicationError.notFound(
                        ErrorCodes.RESOURCE_NOT_FOUND,
                        'Target LaTeX folder not found'
                    ));
                }
            }

            const mimetype = input.file.mimetype ?? '';
            const originalName = input.file.originalname ?? 'imported';
            const ext = path.extname(originalName).toLowerCase();
            const isZip = ext === '.zip' || mimetype === 'application/zip' || mimetype === 'application/x-zip-compressed';
            const isPdf = ext === '.pdf' || mimetype === 'application/pdf';
            const storageClusterId = await this.teamClusterSelectionService.resolveStorageClusterId(input.teamId);

            if (isZip) {
                return await this.importFromZip(input, storageClusterId);
            }

            if (isPdf) {
                return await this.importFromPdf(input, storageClusterId);
            }

            return await this.importFromTex(input, storageClusterId);
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to import LaTeX document',
                500
            ));
        }
    }

    private async importFromTex(
        input: ImportLatexDocumentInputDTO,
        storageClusterId: string
    ): Promise<Result<ImportLatexDocumentOutputDTO, ApplicationError>> {
        const content = input.file.buffer.toString('utf-8');
        const title = this.deriveTitle(input.file.originalname);

        const document = await this.latexDocumentRepository.create({
            team: input.teamId,
            title,
            folder: input.folderId ?? null,
            storageClusterId,
            createdBy: input.userId,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await this.latexFileRepository.create({
            document: document._id,
            team: input.teamId,
            name: MAIN_TEX_FILENAME,
            path: '',
            content,
            isEntrypoint: true,
            createdBy: input.userId,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        return Result.ok({
            _id: document._id,
            title: document.props.title,
            folder: document.props.folder,
            createdAt: document.props.createdAt,
            updatedAt: document.props.updatedAt
        });
    }

    private async importFromZip(
        input: ImportLatexDocumentInputDTO,
        storageClusterId: string
    ): Promise<Result<ImportLatexDocumentOutputDTO, ApplicationError>> {
        let directory: unzipper.CentralDirectory;

        try {
            directory = await unzipper.Open.buffer(input.file.buffer);
        } catch {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'Invalid ZIP archive'
            ));
        }

        const mainTexFile = directory.files.find(
            (f) => f.path === MAIN_TEX_FILENAME || f.path.endsWith(`/${MAIN_TEX_FILENAME}`)
        );

        if (!mainTexFile) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'ZIP archive must contain a main.tex file'
            ));
        }

        const mainTexBuffer = await mainTexFile.buffer();
        const content = mainTexBuffer.toString('utf-8');
        const title = this.deriveTitle(input.file.originalname);

        const document = await this.latexDocumentRepository.create({
            team: input.teamId,
            title,
            folder: input.folderId ?? null,
            storageClusterId,
            createdBy: input.userId,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Create LatexFile for main.tex (entrypoint).
        await this.latexFileRepository.create({
            document: document._id,
            team: input.teamId,
            name: MAIN_TEX_FILENAME,
            path: '',
            content,
            isEntrypoint: true,
            createdBy: input.userId,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        const otherFiles = directory.files.filter((f) => {
            const filePath = f.path;
            return (
                !filePath.endsWith('/') &&
                filePath !== MAIN_TEX_FILENAME &&
                f.path !== mainTexFile.path
            );
        });

        const texFiles = otherFiles.filter((f) => f.path.endsWith('.tex'));
        const assetFiles = otherFiles.filter((f) => !f.path.endsWith('.tex'));

        // Create additional LatexFile records for other .tex files in the ZIP.
        await Promise.allSettled(
            texFiles.map(async (texFile) => {
                const buffer = await texFile.buffer();
                const fileContent = buffer.toString('utf-8');
                const fileName = path.basename(texFile.path);
                const dirPart = path.dirname(texFile.path);
                const filePath = dirPart === '.' ? '' : `${dirPart}/`;

                await this.latexFileRepository.create({
                    document: document._id,
                    team: input.teamId,
                    name: fileName,
                    path: filePath,
                    content: fileContent,
                    isEntrypoint: false,
                    createdBy: input.userId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            })
        );

        await Promise.allSettled(
            assetFiles.map((assetFile) => this.uploadAssetFromZipEntry(
                assetFile,
                document._id,
                storageClusterId,
                input.teamId,
                input.userId
            ))
        );

        return Result.ok({
            _id: document._id,
            title: document.props.title,
            folder: document.props.folder,
            createdAt: document.props.createdAt,
            updatedAt: document.props.updatedAt
        });
    }

    /**
     * Imports a PDF file by storing it as a LatexAsset and generating a
     * `main.tex` that includes it via `\usepackage{pdfpages}`.
     *
     * Requires `pdfpages` to be available in the TeX environment
     * (shipped with `texlive-latex-extra` or `texlive-full`).
     */
    private async importFromPdf(
        input: ImportLatexDocumentInputDTO,
        storageClusterId: string
    ): Promise<Result<ImportLatexDocumentOutputDTO, ApplicationError>> {
        const originalName = input.file.originalname ?? 'imported.pdf';
        const title = this.deriveTitle(originalName);
        const ext = path.extname(originalName);
        const mimetype = input.file.mimetype ?? 'application/pdf';

        const mainTexContent = [
            '\\documentclass{article}',
            '\\usepackage{pdfpages}',
            '\\begin{document}',
            `\\includepdf[pages=-]{${originalName}}`,
            '\\end{document}',
        ].join('\n');

        const document = await this.latexDocumentRepository.create({
            team: input.teamId,
            title,
            folder: input.folderId ?? null,
            storageClusterId,
            createdBy: input.userId,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        const storageKey = buildLatexAssetStorageKey(input.teamId, document._id, v4(), ext);
        const url = buildLatexAssetContentUrl(input.teamId, document._id, storageKey);

        await this.objectGatewayClient.putBuffer(storageClusterId, {
            bucket: TEAM_CLUSTER_BUCKETS.LATEX_ASSETS,
            objectKey: storageKey,
            buffer: input.file.buffer,
            contentLength: input.file.buffer.byteLength,
            contentType: mimetype
        });

        await this.latexFileRepository.create({
            document: document._id,
            team: input.teamId,
            name: MAIN_TEX_FILENAME,
            path: '',
            content: mainTexContent,
            isEntrypoint: true,
            createdBy: input.userId,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await this.latexAssetRepository.create({
            team: input.teamId,
            document: document._id,
            originalName,
            path: originalName,
            storageKey,
            url,
            mimetype,
            size: input.file.buffer.byteLength,
            createdBy: input.userId,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        return Result.ok({
            _id: document._id,
            title: document.props.title,
            folder: document.props.folder,
            createdAt: document.props.createdAt,
            updatedAt: document.props.updatedAt
        });
    }

    private async uploadAssetFromZipEntry(
        assetFile: unzipper.File,
        documentId: string,
        storageClusterId: string,
        teamId: string,
        userId: string
    ): Promise<void> {
        const buffer = await assetFile.buffer();
        const originalName = path.basename(assetFile.path);
        const ext = path.extname(originalName);
        const storageKey = buildLatexAssetStorageKey(teamId, documentId, v4(), ext);
        const mimetype = 'application/octet-stream';
        const assetPath = sanitizeAssetPath(assetFile.path, originalName);
        const url = buildLatexAssetContentUrl(teamId, documentId, storageKey);

        await this.objectGatewayClient.putBuffer(storageClusterId, {
            bucket: TEAM_CLUSTER_BUCKETS.LATEX_ASSETS,
            objectKey: storageKey,
            buffer,
            contentLength: buffer.byteLength,
            contentType: mimetype
        });

        await this.latexAssetRepository.create({
            team: teamId,
            document: documentId,
            originalName,
            path: assetPath,
            storageKey,
            url,
            mimetype,
            size: buffer.byteLength,
            createdBy: userId,
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }

    /** Derives a document title from the uploaded filename (without extension). */
    private deriveTitle(filename: string): string {
        const base = path.basename(filename, path.extname(filename));
        const cleaned = base.trim().replace(/[_-]+/g, ' ');
        return cleaned || 'Imported Document';
    }
}
