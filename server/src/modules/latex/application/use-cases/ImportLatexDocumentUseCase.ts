import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { SYS_BUCKETS } from '@core/config/minio';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import { v4 } from 'uuid';
import path from 'node:path';
import unzipper from 'unzipper';
import type { ImportLatexDocumentInputDTO, ImportLatexDocumentOutputDTO } from '@modules/latex/application/dtos/ImportLatexDocumentDTO';
import type { IUseCase } from '@shared/application/IUseCase';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type { ILatexAssetRepository } from '@modules/latex/domain/port/ILatexAssetRepository';
import type { IStorageService } from '@shared/domain/port/IStorageService';

const MAX_IMPORT_SIZE = 100 * 1024 * 1024;
const MAIN_TEX_FILENAME = 'main.tex';
const ASSETS_PREFIX = 'assets/';

/**
 * Imports a `.tex` or `.zip` file and creates a new LaTeX document.
 *
 * - `.tex`: the file content becomes `main.tex` of the new document.
 * - `.zip`: `main.tex` (at root or in `assets/` is ignored) is used as the document content;
 *   all other files under `assets/` are uploaded as document assets.
 */
@injectable()
export class ImportLatexDocumentUseCase implements IUseCase<ImportLatexDocumentInputDTO, ImportLatexDocumentOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository)
        private readonly latexDocumentRepository: ILatexDocumentRepository,

        @inject(LATEX_TOKENS.LatexAssetRepository)
        private readonly latexAssetRepository: ILatexAssetRepository,

        @inject(SHARED_TOKENS.StorageService)
        private readonly storageService: IStorageService
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

            const mimetype = input.file.mimetype ?? '';
            const originalName = input.file.originalname ?? 'imported';
            const ext = path.extname(originalName).toLowerCase();
            const isZip = ext === '.zip' || mimetype === 'application/zip' || mimetype === 'application/x-zip-compressed';

            if (isZip) {
                return await this.importFromZip(input);
            }

            return await this.importFromTex(input);
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

    private async importFromTex(input: ImportLatexDocumentInputDTO): Promise<Result<ImportLatexDocumentOutputDTO, ApplicationError>> {
        const content = input.file.buffer.toString('utf-8');
        const title = this.deriveTitle(input.file.originalname);

        const document = await this.latexDocumentRepository.create({
            team: input.teamId,
            title,
            content,
            createdBy: input.userId,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        return Result.ok({
            _id: document._id,
            title: document.props.title,
            content: document.props.content,
            createdAt: document.props.createdAt,
            updatedAt: document.props.updatedAt
        });
    }

    private async importFromZip(input: ImportLatexDocumentInputDTO): Promise<Result<ImportLatexDocumentOutputDTO, ApplicationError>> {
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
            (f) => f.path === MAIN_TEX_FILENAME || f.path === `${ASSETS_PREFIX}${MAIN_TEX_FILENAME}`
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
            content,
            createdBy: input.userId,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        const assetFiles = directory.files.filter((f) => {
            const filePath = f.path;
            return (
                !filePath.endsWith('/') &&
                filePath !== MAIN_TEX_FILENAME &&
                filePath.startsWith(ASSETS_PREFIX)
            );
        });

        await Promise.allSettled(
            assetFiles.map((assetFile) => this.uploadAssetFromZipEntry(
                assetFile,
                document._id,
                input.teamId,
                input.userId
            ))
        );

        return Result.ok({
            _id: document._id,
            title: document.props.title,
            content: document.props.content,
            createdAt: document.props.createdAt,
            updatedAt: document.props.updatedAt
        });
    }

    private async uploadAssetFromZipEntry(
        assetFile: unzipper.File,
        documentId: string,
        teamId: string,
        userId: string
    ): Promise<void> {
        const buffer = await assetFile.buffer();
        const originalName = path.basename(assetFile.path);
        const ext = path.extname(originalName);
        const storageKey = `latex-assets/${teamId}/${documentId}/${v4()}${ext}`;
        const mimetype = 'application/octet-stream';

        await this.storageService.upload(
            SYS_BUCKETS.LATEX_ASSETS,
            storageKey,
            buffer,
            { 'Content-Type': mimetype }
        );

        const url = this.storageService.getPublicURL(SYS_BUCKETS.LATEX_ASSETS, storageKey);

        await this.latexAssetRepository.create({
            team: teamId,
            document: documentId,
            originalName,
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
};
