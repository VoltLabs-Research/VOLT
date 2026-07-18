import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import type { CompileLatexDocumentInputDTO, CompileLatexDocumentOutputDTO } from '@modules/latex/application/dtos/CompileLatexDocumentDTO';
import type { CreateLatexDocumentInputDTO, CreateLatexDocumentOutputDTO } from '@modules/latex/application/dtos/CreateLatexDocumentDTO';
import type { CreateLatexFileInputDTO, CreateLatexFileOutputDTO } from '@modules/latex/application/dtos/CreateLatexFileDTO';
import type { DeleteLatexAssetInputDTO, DeleteLatexAssetOutputDTO } from '@modules/latex/application/dtos/DeleteLatexAssetDTO';
import type { DeleteLatexDocumentInputDTO, DeleteLatexDocumentOutputDTO } from '@modules/latex/application/dtos/DeleteLatexDocumentDTO';
import type { DeleteLatexFileInputDTO, DeleteLatexFileOutputDTO } from '@modules/latex/application/dtos/DeleteLatexFileDTO';
import type { ExportLatexDocumentInputDTO, ExportLatexDocumentOutputDTO } from '@modules/latex/application/dtos/ExportLatexDocumentDTO';
import type { GetLatexAssetContentInputDTO, GetLatexAssetContentOutputDTO } from '@modules/latex/application/dtos/GetLatexAssetContentDTO';
import type { GetLatexDocumentInputDTO } from '@modules/latex/application/dtos/GetLatexDocumentDTO';
import type { ImportLatexDocumentInputDTO, ImportLatexDocumentOutputDTO } from '@modules/latex/application/dtos/ImportLatexDocumentDTO';
import type { LatexDocumentDTO } from '@modules/latex/application/dtos/LatexDocumentDTO';
import type { LatexFileDTO } from '@modules/latex/application/dtos/LatexFileDTO';
import type { ListLatexAssetsInputDTO, ListLatexAssetsOutputDTO } from '@modules/latex/application/dtos/ListLatexAssetsDTO';
import type { ListLatexDocumentsInputDTO, ListLatexDocumentsOutputDTO } from '@modules/latex/application/dtos/ListLatexDocumentsDTO';
import type { ListLatexFilesInputDTO, ListLatexFilesOutputDTO } from '@modules/latex/application/dtos/ListLatexFilesDTO';
import type { MoveLatexDocumentInputDTO, MoveLatexDocumentOutputDTO } from '@modules/latex/application/dtos/MoveLatexDocumentDTO';
import type { SetLatexFileEntrypointInputDTO } from '@modules/latex/application/dtos/SetLatexFileEntrypointDTO';
import type { UpdateLatexAssetInputDTO, UpdateLatexAssetOutputDTO } from '@modules/latex/application/dtos/UpdateLatexAssetDTO';
import type { UpdateLatexDocumentInputDTO, UpdateLatexDocumentOutputDTO } from '@modules/latex/application/dtos/UpdateLatexDocumentDTO';
import type { UpdateLatexFileInputDTO, UpdateLatexFileOutputDTO } from '@modules/latex/application/dtos/UpdateLatexFileDTO';
import type { LatexAssetUploadTargetDTO, UploadLatexAssetInputDTO, UploadLatexAssetOutputDTO } from '@modules/latex/application/dtos/UploadLatexAssetDTO';
import { CompileLatexDocumentUseCase } from '@modules/latex/application/use-cases/CompileLatexDocumentUseCase';
import { CreateLatexDocumentUseCase } from '@modules/latex/application/use-cases/CreateLatexDocumentUseCase';
import { CreateLatexFileUseCase } from '@modules/latex/application/use-cases/CreateLatexFileUseCase';
import { DeleteLatexDocumentUseCase } from '@modules/latex/application/use-cases/DeleteLatexDocumentUseCase';
import { DeleteLatexFileUseCase } from '@modules/latex/application/use-cases/DeleteLatexFileUseCase';
import { ExportLatexDocumentTexUseCase } from '@modules/latex/application/use-cases/ExportLatexDocumentTexUseCase';
import { ExportLatexDocumentZipUseCase } from '@modules/latex/application/use-cases/ExportLatexDocumentZipUseCase';
import { GetLatexDocumentUseCase } from '@modules/latex/application/use-cases/GetLatexDocumentUseCase';
import { ListLatexAssetsUseCase } from '@modules/latex/application/use-cases/ListLatexAssetsUseCase';
import { ListLatexDocumentsUseCase } from '@modules/latex/application/use-cases/ListLatexDocumentsUseCase';
import { ListLatexFilesUseCase } from '@modules/latex/application/use-cases/ListLatexFilesUseCase';
import { MoveLatexDocumentUseCase } from '@modules/latex/application/use-cases/MoveLatexDocumentUseCase';
import { SetLatexFileEntrypointUseCase } from '@modules/latex/application/use-cases/SetLatexFileEntrypointUseCase';
import { UpdateLatexDocumentUseCase } from '@modules/latex/application/use-cases/UpdateLatexDocumentUseCase';
import { UpdateLatexFileUseCase } from '@modules/latex/application/use-cases/UpdateLatexFileUseCase';
import {
    assertLatexAssetStorageKey,
    buildLatexAssetContentUrl,
    buildLatexAssetStorageKey,
    requireLatexStorageClusterId
} from '@modules/latex/application/utilities/latex-storage';
import { sanitizeAssetPath } from '@modules/latex/application/utilities/sanitize-asset-path';
import type { ILatexAssetRepository } from '@modules/latex/domain/port/ILatexAssetRepository';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type { ILatexFileRepository } from '@modules/latex/domain/port/ILatexFileRepository';
import type { ILatexFolderRepository } from '@modules/latex/domain/port/ILatexFolderRepository';
import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { CLUSTER_ACCESS_TOKENS } from '@shared/contracts/tokens/ClusterAccessTokens';
import type {
    IClusterObjectSignedUrlService,
    ITeamClusterObjectGatewayClient,
    ITeamClusterSelectionService
} from '@shared/contracts/ports';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject } from 'tsyringe';
import path from 'node:path';
import unzipper from 'unzipper';
import { v4 } from 'uuid';

const MAX_IMPORT_SIZE = 100 * 1024 * 1024;
const MAIN_TEX_FILENAME = 'main.tex';
const MAX_ASSET_SIZE = 50 * 1024 * 1024;

/**
 * The single application service for the latex module. Methods either fold the
 * exact logic of a previously separate use case (converting the Result error
 * channel to thrown `ApplicationError`s so Express 5 forwards them to the global
 * error middleware) or delegate to a retained use case that still has a
 * non-controller consumer (AI tools, the event handler, the folder use case, or
 * the socket module). Delegators unwrap the Result onto the same thrown-error
 * channel, mirroring the auth/raster modules.
 */
@Singleton(LATEX_TOKENS.LatexService)
export default class LatexService {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository) private readonly latexDocumentRepository: ILatexDocumentRepository,
        @inject(LATEX_TOKENS.LatexAssetRepository) private readonly latexAssetRepository: ILatexAssetRepository,
        @inject(LATEX_TOKENS.LatexFileRepository) private readonly latexFileRepository: ILatexFileRepository,
        @inject(LATEX_TOKENS.LatexFolderRepository) private readonly latexFolderRepository: ILatexFolderRepository,
        @inject(SHARED_TOKENS.TeamClusterObjectGatewayClient) private readonly objectGatewayClient: ITeamClusterObjectGatewayClient,
        @inject(CLUSTER_ACCESS_TOKENS.TeamClusterSelectionService) private readonly teamClusterSelectionService: ITeamClusterSelectionService,
        @inject(CLUSTER_ACCESS_TOKENS.ClusterObjectSignedUrlService) private readonly signedUrlService: IClusterObjectSignedUrlService,
        @inject(CompileLatexDocumentUseCase) private readonly compileLatexDocumentUseCase: CompileLatexDocumentUseCase,
        @inject(CreateLatexDocumentUseCase) private readonly createLatexDocumentUseCase: CreateLatexDocumentUseCase,
        @inject(CreateLatexFileUseCase) private readonly createLatexFileUseCase: CreateLatexFileUseCase,
        @inject(DeleteLatexDocumentUseCase) private readonly deleteLatexDocumentUseCase: DeleteLatexDocumentUseCase,
        @inject(DeleteLatexFileUseCase) private readonly deleteLatexFileUseCase: DeleteLatexFileUseCase,
        @inject(ExportLatexDocumentTexUseCase) private readonly exportLatexDocumentTexUseCase: ExportLatexDocumentTexUseCase,
        @inject(ExportLatexDocumentZipUseCase) private readonly exportLatexDocumentZipUseCase: ExportLatexDocumentZipUseCase,
        @inject(GetLatexDocumentUseCase) private readonly getLatexDocumentUseCase: GetLatexDocumentUseCase,
        @inject(ListLatexAssetsUseCase) private readonly listLatexAssetsUseCase: ListLatexAssetsUseCase,
        @inject(ListLatexDocumentsUseCase) private readonly listLatexDocumentsUseCase: ListLatexDocumentsUseCase,
        @inject(ListLatexFilesUseCase) private readonly listLatexFilesUseCase: ListLatexFilesUseCase,
        @inject(MoveLatexDocumentUseCase) private readonly moveLatexDocumentUseCase: MoveLatexDocumentUseCase,
        @inject(SetLatexFileEntrypointUseCase) private readonly setLatexFileEntrypointUseCase: SetLatexFileEntrypointUseCase,
        @inject(UpdateLatexDocumentUseCase) private readonly updateLatexDocumentUseCase: UpdateLatexDocumentUseCase,
        @inject(UpdateLatexFileUseCase) private readonly updateLatexFileUseCase: UpdateLatexFileUseCase
    ) {}

    // --- Delegators to retained use cases (non-controller consumers) ---

    async compileDocument(input: CompileLatexDocumentInputDTO): Promise<CompileLatexDocumentOutputDTO> {
        return this.compileLatexDocumentUseCase.execute(input);
    }

    async createDocument(input: CreateLatexDocumentInputDTO): Promise<CreateLatexDocumentOutputDTO> {
        return this.createLatexDocumentUseCase.execute(input);
    }

    async createFile(input: CreateLatexFileInputDTO): Promise<CreateLatexFileOutputDTO> {
        return this.createLatexFileUseCase.execute(input);
    }

    async deleteDocument(input: DeleteLatexDocumentInputDTO): Promise<DeleteLatexDocumentOutputDTO> {
        return this.deleteLatexDocumentUseCase.execute(input);
    }

    async deleteFile(input: DeleteLatexFileInputDTO): Promise<DeleteLatexFileOutputDTO> {
        return this.deleteLatexFileUseCase.execute(input);
    }

    async exportDocumentTex(input: ExportLatexDocumentInputDTO): Promise<ExportLatexDocumentOutputDTO> {
        return this.exportLatexDocumentTexUseCase.execute(input);
    }

    async exportDocumentZip(input: ExportLatexDocumentInputDTO): Promise<ExportLatexDocumentOutputDTO> {
        return this.exportLatexDocumentZipUseCase.execute(input);
    }

    async getDocument(input: GetLatexDocumentInputDTO): Promise<LatexDocumentDTO> {
        return this.getLatexDocumentUseCase.execute(input);
    }

    async listAssets(input: ListLatexAssetsInputDTO): Promise<ListLatexAssetsOutputDTO> {
        return this.listLatexAssetsUseCase.execute(input);
    }

    async listDocuments(input: ListLatexDocumentsInputDTO): Promise<ListLatexDocumentsOutputDTO> {
        return this.listLatexDocumentsUseCase.execute(input);
    }

    async listFiles(input: ListLatexFilesInputDTO): Promise<ListLatexFilesOutputDTO> {
        return this.listLatexFilesUseCase.execute(input);
    }

    async moveDocument(input: MoveLatexDocumentInputDTO): Promise<MoveLatexDocumentOutputDTO> {
        return this.moveLatexDocumentUseCase.execute(input);
    }

    async setFileEntrypoint(input: SetLatexFileEntrypointInputDTO): Promise<LatexFileDTO> {
        return this.setLatexFileEntrypointUseCase.execute(input);
    }

    async updateDocument(input: UpdateLatexDocumentInputDTO): Promise<UpdateLatexDocumentOutputDTO> {
        return this.updateLatexDocumentUseCase.execute(input);
    }

    async updateFile(input: UpdateLatexFileInputDTO): Promise<UpdateLatexFileOutputDTO> {
        return this.updateLatexFileUseCase.execute(input);
    }

    // --- Folded logic (controller-only use cases) ---

    async deleteAsset(input: DeleteLatexAssetInputDTO): Promise<DeleteLatexAssetOutputDTO> {
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

        const asset = await this.latexAssetRepository.findByDocumentAndAssetId(
            input.documentId,
            input.assetId
        );

        if (!asset) {
            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'LaTeX asset not found'
            );
        }

        try {
            await this.objectGatewayClient.deleteObject(storageClusterId, TEAM_CLUSTER_BUCKETS.LATEX_ASSETS, asset.props.storageKey);
        } catch (error) {
            if (!(error instanceof ApplicationError) || error.statusCode !== 404) {
                throw error;
            }
        }
        await this.latexAssetRepository.deleteById(input.assetId);

        return null;
    }

    async getAssetContent(input: GetLatexAssetContentInputDTO): Promise<GetLatexAssetContentOutputDTO> {
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
        assertLatexAssetStorageKey(input.teamId, input.documentId, input.key);

        const response = await this.objectGatewayClient.getStream(
            storageClusterId,
            TEAM_CLUSTER_BUCKETS.LATEX_ASSETS,
            input.key
        );

        return {
            stream: response.stream,
            contentType: response.contentType,
            contentLength: response.contentLength,
            contentEncoding: response.contentEncoding
        };
    }

    async updateAsset(input: UpdateLatexAssetInputDTO): Promise<UpdateLatexAssetOutputDTO> {
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

        const asset = await this.latexAssetRepository.findByDocumentAndAssetId(
            input.documentId,
            input.assetId
        );

        if (!asset) {
            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'LaTeX asset not found'
            );
        }

        const safePath = sanitizeAssetPath(input.path, asset.props.originalName);
        const updated = await this.latexAssetRepository.updateById(input.assetId, {
            path: safePath,
            updatedAt: new Date()
        });

        if (!updated) {
            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'LaTeX asset not found'
            );
        }

        return {
            _id: updated._id,
            documentId: updated.props.document,
            originalName: updated.props.originalName,
            path: updated.props.path,
            url: buildLatexAssetContentUrl(input.teamId, input.documentId, updated.props.storageKey),
            mimetype: updated.props.mimetype,
            size: updated.props.size,
            createdAt: updated.props.createdAt
        };
    }

    async uploadAsset(input: UploadLatexAssetInputDTO): Promise<UploadLatexAssetOutputDTO> {
        const validFiles = (input.files ?? [])
            .map((file, uploadIndex) => ({ file, uploadIndex }))
            .filter(({ file }) => file && file.name && file.size >= 0);

        if (validFiles.length === 0) {
            throw ApplicationError.badRequest(
                ErrorCodes.FILE_READ_ERROR,
                'No valid files provided'
            );
        }

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

        return {
            uploaded,
            failedCount,
            total: validFiles.length
        };
    }

    async importDocument(input: ImportLatexDocumentInputDTO): Promise<ImportLatexDocumentOutputDTO> {
        if (!input.file?.buffer?.length) {
            throw ApplicationError.badRequest(
                ErrorCodes.FILE_READ_ERROR,
                'No file provided or file is empty'
            );
        }

        if (input.file.size > MAX_IMPORT_SIZE) {
            throw ApplicationError.badRequest(
                ErrorCodes.FILE_READ_ERROR,
                'File exceeds the 100MB import size limit'
            );
        }

        if (input.folderId) {
            const folder = await this.latexFolderRepository.findByTeamAndFolderId(
                input.teamId,
                input.folderId
            );

            if (!folder) {
                throw ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'Target LaTeX folder not found'
                );
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
    }

    private async importFromTex(
        input: ImportLatexDocumentInputDTO,
        storageClusterId: string
    ): Promise<ImportLatexDocumentOutputDTO> {
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

        return {
            _id: document._id,
            title: document.props.title,
            folder: document.props.folder,
            createdAt: document.props.createdAt,
            updatedAt: document.props.updatedAt
        };
    }

    private async importFromZip(
        input: ImportLatexDocumentInputDTO,
        storageClusterId: string
    ): Promise<ImportLatexDocumentOutputDTO> {
        let directory: unzipper.CentralDirectory;

        try {
            directory = await unzipper.Open.buffer(input.file.buffer);
        } catch {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'Invalid ZIP archive'
            );
        }

        const mainTexFile = directory.files.find(
            (f) => f.path === MAIN_TEX_FILENAME || f.path.endsWith(`/${MAIN_TEX_FILENAME}`)
        );

        if (!mainTexFile) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'ZIP archive must contain a main.tex file'
            );
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

        return {
            _id: document._id,
            title: document.props.title,
            folder: document.props.folder,
            createdAt: document.props.createdAt,
            updatedAt: document.props.updatedAt
        };
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
    ): Promise<ImportLatexDocumentOutputDTO> {
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

        return {
            _id: document._id,
            title: document.props.title,
            folder: document.props.folder,
            createdAt: document.props.createdAt,
            updatedAt: document.props.updatedAt
        };
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
