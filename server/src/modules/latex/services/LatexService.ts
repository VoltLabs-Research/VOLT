import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import LatexDocumentModel from '@modules/latex/models/LatexDocumentModel';
import type { LatexDocumentDocument } from '@modules/latex/models/LatexDocumentModel';
import LatexFileModel from '@modules/latex/models/LatexFileModel';
import type { LatexFileDocument } from '@modules/latex/models/LatexFileModel';
import LatexAssetModel from '@modules/latex/models/LatexAssetModel';
import type { LatexAssetDocument } from '@modules/latex/models/LatexAssetModel';
import CatalogFolderModel from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import LatexDocumentCreatedEvent from '@modules/latex/events/LatexDocumentCreatedEvent';
import LatexDocumentDeletedEvent from '@modules/latex/events/LatexDocumentDeletedEvent';
import LatexFileContentUpdatedEvent from '@modules/latex/events/LatexFileContentUpdatedEvent';
import {
    getDocumentCompileWorkDirSegment,
    prepareWorkDir,
    runCompiler,
    withDocumentCompileLock
} from '@modules/latex/ai-tools/compile-helpers';
import {
    assertLatexAssetStorageKey,
    buildLatexAssetContentUrl,
    buildLatexAssetStorageKey,
    requireLatexStorageClusterId
} from '@modules/latex/utilities/latex-storage';
import { sanitizeAssetPath } from '@modules/latex/utilities/sanitize-asset-path';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { CLUSTER_ACCESS_TOKENS } from '@shared/contracts/tokens/ClusterAccessTokens';
import type {
    ITeamClusterObjectGatewayClient,
    ITeamClusterSelectionService
} from '@shared/contracts/ports';
import ClusterObjectArchiveService from '@modules/cluster/services/ClusterObjectArchiveService';
import ClusterObjectSignedUrlService from '@modules/cluster/services/ClusterObjectSignedUrlService';
import type { DownloadStreamOutputDTO } from '@shared/contracts/types';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { createDownloadStreamResponse, sanitizeDownloadName } from '@shared/infrastructure/http/responses/download-response';
import { LAST_EDITED_BY_POPULATE, USER_POPULATE } from '@shared/infrastructure/persistence/mongo/PopulatePresets';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { ITempFileService } from '@shared/domain/port/ITempFileService';
import type { HydratedDocument } from 'mongoose';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import unzipper from 'unzipper';
import { v4 } from 'uuid';
import { container as diContainer } from 'tsyringe';
import type {
    CreateLatexDocumentInput,
    UpdateLatexDocumentInput,
    CreateLatexFileInput,
    UpdateLatexFileInput,
    UploadLatexAssetInput,
    CreateLatexFolderInput,
    UpdateLatexFolderInput
} from '@volt/contracts/modules/latex/http';
import type {
    LatexDocumentView,
    LatexFileView,
    LatexAssetView,
    UploadLatexAssetResult,
    LatexFolderView,
    LatexAssetUploadTarget
} from '@volt/contracts/modules/latex/domain';

const MAX_IMPORT_SIZE = 100 * 1024 * 1024;
const MAIN_TEX_FILENAME = 'main.tex';
const MAX_ASSET_SIZE = 50 * 1024 * 1024;

type LatexDocumentDoc = HydratedDocument<LatexDocumentDocument>;
type LatexFileDoc = HydratedDocument<LatexFileDocument>;
type LatexAssetDoc = HydratedDocument<LatexAssetDocument>;

type CatalogFolderDoc = { _id: unknown; title: string; parent: unknown; createdAt: Date; updatedAt: Date };

interface TeamScoped { teamId: string }
interface DocumentScoped extends TeamScoped { documentId: string }

const toDocumentView = (doc: LatexDocumentDoc): LatexDocumentView => ({
    _id: String(doc._id),
    title: doc.title,
    folder: doc.folder ? String(doc.folder) : null,
    createdBy: doc.createdBy,
    lastEditedBy: doc.lastEditedBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
}) as unknown as LatexDocumentView;

const toFileView = (doc: LatexFileDoc): LatexFileView => ({
    _id: String(doc._id),
    documentId: String(doc.document),
    name: doc.name,
    path: doc.path,
    content: doc.content,
    isEntrypoint: doc.isEntrypoint,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
}) as unknown as LatexFileView;

const toFolderView = (folder: CatalogFolderDoc): LatexFolderView => ({
    _id: String(folder._id),
    title: folder.title,
    parent: folder.parent ? String(folder.parent) : null,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt
}) as unknown as LatexFolderView;

export default class LatexService {
    #signedUrlService = new ClusterObjectSignedUrlService();
    #archiveService = new ClusterObjectArchiveService();

    #objectGatewayClientCache?: ITeamClusterObjectGatewayClient;
    get #objectGatewayClient(): ITeamClusterObjectGatewayClient {
        return (this.#objectGatewayClientCache ??= diContainer.resolve<ITeamClusterObjectGatewayClient>(SHARED_TOKENS.TeamClusterObjectGatewayClient));
    }

    #teamClusterSelectionServiceCache?: ITeamClusterSelectionService;
    get #teamClusterSelectionService(): ITeamClusterSelectionService {
        return (this.#teamClusterSelectionServiceCache ??= diContainer.resolve<ITeamClusterSelectionService>(CLUSTER_ACCESS_TOKENS.TeamClusterSelectionService));
    }

    #tempFileServiceCache?: ITempFileService;
    get #tempFileService(): ITempFileService {
        return (this.#tempFileServiceCache ??= diContainer.resolve<ITempFileService>(SHARED_TOKENS.TempFileService));
    }

    #eventBusCache?: IEventBus;
    get #eventBus(): IEventBus {
        return (this.#eventBusCache ??= diContainer.resolve<IEventBus>(SHARED_TOKENS.EventBus));
    }

    async listDocuments(input: TeamScoped & { page?: number; limit?: number; search?: string; folderId?: string }): Promise<PaginatedResult<LatexDocumentView>> {
        const page = Math.max(1, Number(input.page) || 1);
        const limit = Math.max(1, Math.min(500, Number(input.limit) || 500));

        const filter: Record<string, unknown> = { team: input.teamId };
        if (input.search) {
            filter.title = { $regex: input.search, $options: 'i' };
        }
        if (input.folderId) {
            filter.folder = input.folderId === 'root' ? null : input.folderId;
        }

        const [docs, total] = await Promise.all([
            LatexDocumentModel.find(filter)
                .skip((page - 1) * limit)
                .limit(limit)
                .sort({ updatedAt: -1 })
                .populate(USER_POPULATE)
                .populate(LAST_EDITED_BY_POPULATE)
                .exec(),
            LatexDocumentModel.countDocuments(filter)
        ]);

        return {
            data: docs.map((doc) => toDocumentView(doc)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async createDocument(input: CreateLatexDocumentInput & TeamScoped & { userId: string }): Promise<LatexDocumentView> {
        const title = input.title?.trim();
        if (!title) {
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'Document title is required');
        }

        if (input.folderId) {
            await this.#requireFolder(input.teamId, input.folderId);
        }

        const storageClusterId = await this.#teamClusterSelectionService.resolveStorageClusterId(input.teamId);

        const document = await LatexDocumentModel.create({
            team: input.teamId,
            title,
            storageClusterId,
            createdBy: input.userId,
            lastEditedBy: input.userId,
            folder: input.folderId ?? null,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await this.#eventBus.publish(new LatexDocumentCreatedEvent({
            documentId: String(document._id),
            teamId: input.teamId,
            userId: input.userId,
            documentTitle: document.title ?? ''
        }));

        return toDocumentView(document);
    }

    async getDocument(input: DocumentScoped): Promise<LatexDocumentView> {
        const document = await this.#requireDocument(input.teamId, input.documentId);
        return toDocumentView(document);
    }

    async updateDocument(input: UpdateLatexDocumentInput & DocumentScoped & { userId?: string }): Promise<LatexDocumentView> {
        await this.#requireDocument(input.teamId, input.documentId);

        const patch: Record<string, unknown> = {
            updatedAt: new Date(),
            ...(input.userId === undefined ? {} : { lastEditedBy: input.userId })
        };
        if (input.title !== undefined) {
            patch.title = input.title.trim();
        }

        const updated = await LatexDocumentModel.findByIdAndUpdate(input.documentId, { $set: patch }, { new: true });
        if (!updated) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LaTeX document not found');
        }
        return toDocumentView(updated);
    }

    async deleteDocument(input: DocumentScoped & { userId?: string }): Promise<void> {
        const document = await this.#requireDocument(input.teamId, input.documentId);

        await LatexDocumentModel.deleteOne({ _id: input.documentId });

        await this.#eventBus.publish(new LatexDocumentDeletedEvent({
            documentId: input.documentId,
            teamId: input.teamId,
            storageClusterId: document.storageClusterId,
            userId: input.userId ?? '',
            documentTitle: document.title ?? ''
        }));
    }

    async moveDocument(input: DocumentScoped & { folderId: string | null }): Promise<null> {
        try {
            const document = await LatexDocumentModel.findOne({ _id: input.documentId, team: input.teamId });
            if (!document) {
                throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LaTeX document not found');
            }

            if (input.folderId !== null) {
                await this.#requireFolder(input.teamId, input.folderId, 'Target LaTeX folder not found');
            }

            await LatexDocumentModel.updateOne({ _id: input.documentId }, { $set: { folder: input.folderId } });
            return null;
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to move LaTeX document', 500);
        }
    }

    async importDocument(input: TeamScoped & { userId: string; file: Express.Multer.File; folderId?: string | null }): Promise<LatexDocumentView> {
        if (!input.file?.buffer?.length) {
            throw ApplicationError.badRequest(ErrorCodes.FILE_READ_ERROR, 'No file provided or file is empty');
        }
        if (input.file.size > MAX_IMPORT_SIZE) {
            throw ApplicationError.badRequest(ErrorCodes.FILE_READ_ERROR, 'File exceeds the 100MB import size limit');
        }

        if (input.folderId) {
            await this.#requireFolder(input.teamId, input.folderId, 'Target LaTeX folder not found');
        }

        const mimetype = input.file.mimetype ?? '';
        const originalName = input.file.originalname ?? 'imported';
        const ext = path.extname(originalName).toLowerCase();
        const isZip = ext === '.zip' || mimetype === 'application/zip' || mimetype === 'application/x-zip-compressed';
        const isPdf = ext === '.pdf' || mimetype === 'application/pdf';
        const storageClusterId = await this.#teamClusterSelectionService.resolveStorageClusterId(input.teamId);

        if (isZip) {
            return this.#importFromZip(input, storageClusterId);
        }
        if (isPdf) {
            return this.#importFromPdf(input, storageClusterId);
        }
        return this.#importFromTex(input, storageClusterId);
    }


    async listAssets(input: DocumentScoped): Promise<LatexAssetView[]> {
        await this.#requireDocument(input.teamId, input.documentId);

        const assets = await LatexAssetModel.find({ document: input.documentId }).sort({ createdAt: -1 }).exec();
        return assets.map((asset) => this.#toAssetView(input.teamId, input.documentId, asset));
    }

    async getAssetContent(input: DocumentScoped & { key: string }): Promise<{ stream: Readable; contentType?: string; contentLength?: number; contentEncoding?: string }> {
        const document = await this.#requireDocument(input.teamId, input.documentId);
        const storageClusterId = requireLatexStorageClusterId(String(document._id), document);
        assertLatexAssetStorageKey(input.teamId, input.documentId, input.key);

        const response = await this.#objectGatewayClient.getStream(
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

    async uploadAsset(input: UploadLatexAssetInput & DocumentScoped & { userId: string }): Promise<UploadLatexAssetResult> {
        const validFiles = (input.files ?? [])
            .map((file, uploadIndex) => ({ file, uploadIndex }))
            .filter(({ file }) => file && file.name && file.size >= 0);

        if (validFiles.length === 0) {
            throw ApplicationError.badRequest(ErrorCodes.FILE_READ_ERROR, 'No valid files provided');
        }

        const document = await this.#requireDocument(input.teamId, input.documentId);
        const storageClusterId = requireLatexStorageClusterId(String(document._id), document);

        const uploaded: LatexAssetUploadTarget[] = [];
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

                const asset = await LatexAssetModel.create({
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

                const signed = this.#signedUrlService.createToken({
                    kind: 'cluster-object',
                    operation: 'write',
                    teamId: input.teamId,
                    userId: input.userId,
                    ownerClusterId: storageClusterId,
                    bucket: TEAM_CLUSTER_BUCKETS.LATEX_ASSETS,
                    objectKey: storageKey,
                    resourceKind: 'latex-asset',
                    resourceId: String(asset._id),
                    contentLength: file.size,
                    contentType: mimetype
                });

                uploaded.push({
                    _id: String(asset._id),
                    uploadIndex,
                    documentId: String(asset.document),
                    originalName: asset.originalName,
                    path: asset.path,
                    url: buildLatexAssetContentUrl(input.teamId, input.documentId, asset.storageKey),
                    mimetype: asset.mimetype,
                    size: asset.size,
                    createdAt: asset.createdAt as unknown as string,
                    uploadUrl: signed.url,
                    expiresAt: signed.expiresAt
                });
            } catch {
                failedCount++;
            }
        }

        return { uploaded, failedCount, total: validFiles.length };
    }

    async deleteAsset(input: DocumentScoped & { assetId: string }): Promise<void> {
        const document = await this.#requireDocument(input.teamId, input.documentId);
        const storageClusterId = requireLatexStorageClusterId(String(document._id), document);

        const asset = await LatexAssetModel.findOne({ _id: input.assetId, document: input.documentId });
        if (!asset) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LaTeX asset not found');
        }

        try {
            await this.#objectGatewayClient.deleteObject(storageClusterId, TEAM_CLUSTER_BUCKETS.LATEX_ASSETS, asset.storageKey);
        } catch (error) {
            if (!(error instanceof ApplicationError) || error.statusCode !== 404) {
                throw error;
            }
        }
        await LatexAssetModel.deleteOne({ _id: input.assetId });
    }

    async updateAsset(input: DocumentScoped & { assetId: string; path: string }): Promise<LatexAssetView> {
        await this.#requireDocument(input.teamId, input.documentId);

        const asset = await LatexAssetModel.findOne({ _id: input.assetId, document: input.documentId });
        if (!asset) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LaTeX asset not found');
        }

        const safePath = sanitizeAssetPath(input.path, asset.originalName);
        const updated = await LatexAssetModel.findByIdAndUpdate(
            input.assetId,
            { $set: { path: safePath, updatedAt: new Date() } },
            { new: true }
        );
        if (!updated) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LaTeX asset not found');
        }
        return this.#toAssetView(input.teamId, input.documentId, updated);
    }


    async exportDocumentTex(input: DocumentScoped): Promise<DownloadStreamOutputDTO> {
        const document = await this.#requireDocument(input.teamId, input.documentId);

        const files = await LatexFileModel.find({ document: input.documentId }).sort({ isEntrypoint: -1, createdAt: 1 }).exec();
        const entrypoint = files.find((file) => file.isEntrypoint)
            ?? files.find((file) => file.name.toLowerCase().endsWith('.tex'))
            ?? null;

        if (!entrypoint) {
            throw new ApplicationError(ErrorCodes.LATEX_COMPILATION_FAILED, 'No .tex file was found in this document. Add or select a .tex file to export.', 422);
        }

        const safeName = sanitizeDownloadName(document.title, 'document');
        return createDownloadStreamResponse({
            stream: Readable.from([entrypoint.content]),
            contentType: 'application/x-tex; charset=utf-8',
            filename: `${safeName}.tex`,
            cacheControl: 'no-cache'
        });
    }

    async exportDocumentZip(input: DocumentScoped): Promise<DownloadStreamOutputDTO> {
        const document = await this.#requireDocument(input.teamId, input.documentId);
        const storageClusterId = requireLatexStorageClusterId(String(document._id), document);

        const [latexFiles, assets] = await Promise.all([
            LatexFileModel.find({ document: input.documentId }).sort({ isEntrypoint: -1, createdAt: 1 }).exec(),
            LatexAssetModel.find({ document: input.documentId }).sort({ createdAt: -1 }).exec()
        ]);

        const safeName = sanitizeDownloadName(document.title, 'document');

        if (latexFiles.length === 0) {
            throw new ApplicationError(ErrorCodes.LATEX_COMPILATION_FAILED, 'This document has no LaTeX files. Create main.tex before exporting.', 422);
        }

        return this.#archiveService.createArchiveDownload({
            teamClusterId: storageClusterId,
            outputBucket: TEAM_CLUSTER_BUCKETS.TRAJECTORIES,
            outputObjectKey: `exports/latex/${input.documentId}/${v4()}.zip`,
            filename: `${safeName}.zip`,
            cacheControl: 'no-cache',
            entries: [
                ...latexFiles.map((file) => ({
                    type: 'inline' as const,
                    name: file.path ? `${file.path}${file.name}` : file.name,
                    content: file.content
                })),
                ...assets.map((asset) => ({
                    type: 'object' as const,
                    ownerClusterId: storageClusterId,
                    bucket: TEAM_CLUSTER_BUCKETS.LATEX_ASSETS,
                    objectKey: asset.storageKey,
                    name: sanitizeAssetPath(asset.path, asset.originalName),
                    optional: true
                }))
            ]
        });
    }

    async compileDocument(input: DocumentScoped): Promise<DownloadStreamOutputDTO> {
        const workDir = this.#tempFileService.getDirPath(
            getDocumentCompileWorkDirSegment(input.teamId, input.documentId)
        );

        return withDocumentCompileLock(input.teamId, input.documentId, async () => {
            const preparation = await prepareWorkDir(
                { teamId: input.teamId, documentId: input.documentId, workDir, haltOnError: true },
                { objectGatewayClient: this.#objectGatewayClient, tempFileService: this.#tempFileService }
            );

            if (preparation.status === 'no-document') {
                throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LaTeX document not found');
            }
            if (preparation.status === 'no-files') {
                throw new ApplicationError(ErrorCodes.LATEX_COMPILATION_FAILED, 'This document has no LaTeX files. Create main.tex before compiling.', 422);
            }
            if (preparation.status === 'no-entrypoint') {
                throw new ApplicationError(ErrorCodes.LATEX_COMPILATION_FAILED, 'No .tex file was found in this document. Add or select a .tex file to compile.', 422);
            }
            if (preparation.status === 'no-compiler') {
                throw new ApplicationError(ErrorCodes.LATEX_COMPILER_NOT_FOUND, 'No LaTeX compiler is available on this server. Install texlive (textlive-full) (latexmk, pdflatex, xelatex, or lualatex) to enable PDF compilation.', 503);
            }

            const result = await runCompiler(preparation.compiler, workDir);
            if (!result.success) {
                throw new ApplicationError(ErrorCodes.LATEX_COMPILATION_FAILED, result.log || 'LaTeX compilation failed with no output.', 422);
            }

            const entrypointBaseName = path.parse(preparation.entrypointFilename).name;
            const pdfName = `${entrypointBaseName}.pdf`;
            const entrypointDir = path.dirname(preparation.entrypointFilename);
            const pdfCandidates = [path.join(workDir, pdfName)];
            if (entrypointDir !== '.') {
                pdfCandidates.push(path.join(workDir, entrypointDir, pdfName));
            }

            let pdfBuffer: Buffer | null = null;
            for (const candidate of pdfCandidates) {
                try {
                    pdfBuffer = await fs.readFile(candidate);
                    break;
                } catch (err) {
                    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
                        throw err;
                    }
                }
            }

            if (!pdfBuffer) {
                throw new ApplicationError(
                    ErrorCodes.LATEX_COMPILATION_FAILED,
                    result.log
                        ? `${result.log}\n\nCompilation did not produce the expected PDF output (${pdfName}).`
                        : `Compilation did not produce the expected PDF output (${pdfName}).`,
                    422
                );
            }

            return createDownloadStreamResponse({
                stream: Readable.from(pdfBuffer),
                contentType: 'application/pdf',
                filename: path.basename(pdfName),
                disposition: 'inline',
                contentLength: pdfBuffer.byteLength,
                cacheControl: 'no-cache'
            });
        });
    }


    async listFiles(input: DocumentScoped): Promise<LatexFileView[]> {
        await this.#requireDocument(input.teamId, input.documentId);
        const files = await this.#findFilesByDocument(input.documentId);
        return files.map((file) => toFileView(file));
    }

    async createFile(input: CreateLatexFileInput & DocumentScoped & { userId: string }): Promise<LatexFileView> {
        await this.#requireDocument(input.teamId, input.documentId);

        if (input.isEntrypoint) {
            await this.#clearEntrypointForDocument(input.documentId);
        }

        const file = await LatexFileModel.create({
            document: input.documentId,
            team: input.teamId,
            name: input.name.trim(),
            path: input.path ?? '',
            content: input.content ?? '',
            isEntrypoint: input.isEntrypoint ?? false,
            createdBy: input.userId,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        return toFileView(file);
    }

    async updateFile(input: UpdateLatexFileInput & DocumentScoped & { fileId: string; source?: 'ai' | 'editor' }): Promise<LatexFileView> {
        await this.#requireDocument(input.teamId, input.documentId);

        const existing = await LatexFileModel.findOne({ _id: input.fileId, document: input.documentId });
        if (!existing) {
            throw ApplicationError.notFound(ErrorCodes.LATEX_FILE_NOT_FOUND, 'LaTeX file not found');
        }

        const patch: Record<string, unknown> = { updatedAt: new Date() };
        if (input.name !== undefined) patch.name = input.name.trim();
        if (input.path !== undefined) patch.path = input.path;
        if (input.content !== undefined) patch.content = input.content;

        const updated = await LatexFileModel.findByIdAndUpdate(input.fileId, { $set: patch }, { new: true });
        if (!updated) {
            throw ApplicationError.notFound(ErrorCodes.LATEX_FILE_NOT_FOUND, 'LaTeX file not found');
        }

        if (input.source === 'ai' && input.content !== undefined) {
            await this.#eventBus.publish(new LatexFileContentUpdatedEvent({
                documentId: input.documentId,
                teamId: input.teamId,
                fileId: input.fileId,
                content: input.content
            }));
        }

        return toFileView(updated);
    }

    async deleteFile(input: DocumentScoped & { fileId: string }): Promise<void> {
        await this.#requireDocument(input.teamId, input.documentId);

        const file = await LatexFileModel.findOne({ _id: input.fileId, document: input.documentId });
        if (!file) {
            throw ApplicationError.notFound(ErrorCodes.LATEX_FILE_NOT_FOUND, 'LaTeX file not found');
        }

        if (file.isEntrypoint) {
            const remainingFiles = (await this.#findFilesByDocument(input.documentId))
                .filter((currentFile) => String(currentFile._id) !== input.fileId);

            if (remainingFiles.length > 0) {
                const nextEntrypoint = remainingFiles.find((currentFile) =>
                    currentFile.name.toLowerCase().endsWith('.tex')
                ) ?? remainingFiles[0];

                await this.#clearEntrypointForDocument(input.documentId);
                await LatexFileModel.findByIdAndUpdate(nextEntrypoint._id, { $set: { isEntrypoint: true, updatedAt: new Date() } });
            }
        }

        await LatexFileModel.deleteOne({ _id: input.fileId });
    }

    async setFileEntrypoint(input: DocumentScoped & { fileId: string }): Promise<LatexFileView> {
        await this.#requireDocument(input.teamId, input.documentId);

        const file = await LatexFileModel.findOne({ _id: input.fileId, document: input.documentId });
        if (!file) {
            throw ApplicationError.notFound(ErrorCodes.LATEX_FILE_NOT_FOUND, 'LaTeX file not found');
        }

        await this.#clearEntrypointForDocument(input.documentId);
        const updated = await LatexFileModel.findByIdAndUpdate(input.fileId, { $set: { isEntrypoint: true, updatedAt: new Date() } }, { new: true });
        if (!updated) {
            throw ApplicationError.notFound(ErrorCodes.LATEX_FILE_NOT_FOUND, 'LaTeX file not found after update');
        }
        return toFileView(updated);
    }


    async listFolders(input: TeamScoped & { parentId?: string; page?: number; limit?: number }): Promise<PaginatedResult<LatexFolderView>> {
        const page = Number(input.page) || 1;
        const limit = Number(input.limit) || 500;
        const filter = { team: input.teamId, kind: CatalogFolderKind.Latex, parent: input.parentId ?? null };

        const [docs, total] = await Promise.all([
            CatalogFolderModel.find(filter).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 }).exec(),
            CatalogFolderModel.countDocuments(filter)
        ]);

        return {
            data: docs.map((folder) => toFolderView(folder)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async getFolder(input: TeamScoped & { folderId: string }): Promise<LatexFolderView> {
        const folder = await this.#requireFolder(input.teamId, input.folderId);
        return toFolderView(folder);
    }

    async createFolder(input: CreateLatexFolderInput & TeamScoped & { userId: string }): Promise<LatexFolderView> {
        const folder = await CatalogFolderModel.create({
            team: input.teamId,
            createdBy: input.userId,
            title: input.title,
            parent: input.parentId ?? null,
            kind: CatalogFolderKind.Latex,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        return toFolderView(folder);
    }

    async updateFolder(input: UpdateLatexFolderInput & TeamScoped & { folderId: string }): Promise<LatexFolderView> {
        await this.#requireFolder(input.teamId, input.folderId);
        const updated = await CatalogFolderModel.findByIdAndUpdate(
            input.folderId,
            { $set: { title: input.title, updatedAt: new Date() } },
            { new: true }
        );
        if (!updated) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LaTeX folder not found');
        }
        return toFolderView(updated);
    }

    async deleteFolder(input: TeamScoped & { folderId: string }): Promise<void> {
        try {
            await this.#requireFolder(input.teamId, input.folderId);
            await this.#deleteFolderTree(input.teamId, input.folderId);
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to delete LaTeX folder', 500);
        }
    }

    async deleteAllDocumentsForTeam(teamId: string, userId: string): Promise<void> {
        const documents = await LatexDocumentModel.find({ team: teamId }).select('_id').exec();
        for (const document of documents) {
            await this.deleteDocument({ teamId, documentId: String(document._id), userId });
        }
    }


    async #requireDocument(teamId: string, documentId: string): Promise<LatexDocumentDoc> {
        const document = await LatexDocumentModel.findOne({ _id: documentId, team: teamId });
        if (!document) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LaTeX document not found');
        }
        return document;
    }

    async #requireFolder(teamId: string, folderId: string, message = 'LaTeX folder not found'): Promise<CatalogFolderDoc> {
        const folder = await CatalogFolderModel.findOne({ _id: folderId, team: teamId, kind: CatalogFolderKind.Latex });
        if (!folder) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, message);
        }
        return folder as unknown as CatalogFolderDoc;
    }

    async #findFilesByDocument(documentId: string): Promise<LatexFileDoc[]> {
        return LatexFileModel.find({ document: documentId }).sort({ isEntrypoint: -1, createdAt: 1 }).exec();
    }

    async #clearEntrypointForDocument(documentId: string): Promise<void> {
        await LatexFileModel.updateMany({ document: documentId, isEntrypoint: true }, { $set: { isEntrypoint: false } }).exec();
    }

    #toAssetView(teamId: string, documentId: string, asset: LatexAssetDoc): LatexAssetView {
        return {
            _id: String(asset._id),
            documentId: String(asset.document),
            originalName: asset.originalName,
            path: asset.path,
            url: buildLatexAssetContentUrl(teamId, documentId, asset.storageKey),
            mimetype: asset.mimetype,
            size: asset.size,
            createdAt: asset.createdAt as unknown as string
        };
    }

    async #deleteFolderTree(teamId: string, folderId: string): Promise<void> {
        const subfolders = await CatalogFolderModel.find({ team: teamId, parent: folderId, kind: CatalogFolderKind.Latex });
        for (const subfolder of subfolders) {
            await this.#deleteFolderTree(teamId, String(subfolder._id));
        }

        const documents = await LatexDocumentModel.find({ team: teamId, folder: folderId }).select('_id').exec();
        for (const document of documents) {
            await this.deleteDocument({ teamId, documentId: String(document._id) });
        }

        await CatalogFolderModel.deleteOne({ _id: folderId, team: teamId, kind: CatalogFolderKind.Latex });
    }

    #deriveTitle(filename: string): string {
        const base = path.basename(filename, path.extname(filename));
        const cleaned = base.trim().replace(/[_-]+/g, ' ');
        return cleaned || 'Imported Document';
    }

    async #importFromTex(input: { teamId: string; userId: string; file: Express.Multer.File; folderId?: string | null }, storageClusterId: string): Promise<LatexDocumentView> {
        const content = input.file.buffer.toString('utf-8');
        const title = this.#deriveTitle(input.file.originalname);

        const document = await LatexDocumentModel.create({
            team: input.teamId,
            title,
            folder: input.folderId ?? null,
            storageClusterId,
            createdBy: input.userId,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await LatexFileModel.create({
            document: String(document._id),
            team: input.teamId,
            name: MAIN_TEX_FILENAME,
            path: '',
            content,
            isEntrypoint: true,
            createdBy: input.userId,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        return toDocumentView(document);
    }

    async #importFromZip(input: { teamId: string; userId: string; file: Express.Multer.File; folderId?: string | null }, storageClusterId: string): Promise<LatexDocumentView> {
        let directory: unzipper.CentralDirectory;
        try {
            directory = await unzipper.Open.buffer(input.file.buffer);
        } catch {
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'Invalid ZIP archive');
        }

        const mainTexFile = directory.files.find(
            (f) => f.path === MAIN_TEX_FILENAME || f.path.endsWith(`/${MAIN_TEX_FILENAME}`)
        );
        if (!mainTexFile) {
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'ZIP archive must contain a main.tex file');
        }

        const mainTexBuffer = await mainTexFile.buffer();
        const content = mainTexBuffer.toString('utf-8');
        const title = this.#deriveTitle(input.file.originalname);

        const document = await LatexDocumentModel.create({
            team: input.teamId,
            title,
            folder: input.folderId ?? null,
            storageClusterId,
            createdBy: input.userId,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        const documentId = String(document._id);

        await LatexFileModel.create({
            document: documentId,
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
            return !filePath.endsWith('/') && filePath !== MAIN_TEX_FILENAME && f.path !== mainTexFile.path;
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

                await LatexFileModel.create({
                    document: documentId,
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
            assetFiles.map((assetFile) => this.#uploadAssetFromZipEntry(assetFile, documentId, storageClusterId, input.teamId, input.userId))
        );

        return toDocumentView(document);
    }

    async #importFromPdf(input: { teamId: string; userId: string; file: Express.Multer.File; folderId?: string | null }, storageClusterId: string): Promise<LatexDocumentView> {
        const originalName = input.file.originalname ?? 'imported.pdf';
        const title = this.#deriveTitle(originalName);
        const ext = path.extname(originalName);
        const mimetype = input.file.mimetype ?? 'application/pdf';

        const mainTexContent = [
            '\\documentclass{article}',
            '\\usepackage{pdfpages}',
            '\\begin{document}',
            `\\includepdf[pages=-]{${originalName}}`,
            '\\end{document}'
        ].join('\n');

        const document = await LatexDocumentModel.create({
            team: input.teamId,
            title,
            folder: input.folderId ?? null,
            storageClusterId,
            createdBy: input.userId,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        const documentId = String(document._id);
        const storageKey = buildLatexAssetStorageKey(input.teamId, documentId, v4(), ext);
        const url = buildLatexAssetContentUrl(input.teamId, documentId, storageKey);

        await this.#objectGatewayClient.putBuffer(storageClusterId, {
            bucket: TEAM_CLUSTER_BUCKETS.LATEX_ASSETS,
            objectKey: storageKey,
            buffer: input.file.buffer,
            contentLength: input.file.buffer.byteLength,
            contentType: mimetype
        });

        await LatexFileModel.create({
            document: documentId,
            team: input.teamId,
            name: MAIN_TEX_FILENAME,
            path: '',
            content: mainTexContent,
            isEntrypoint: true,
            createdBy: input.userId,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await LatexAssetModel.create({
            team: input.teamId,
            document: documentId,
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

        return toDocumentView(document);
    }

    async #uploadAssetFromZipEntry(
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

        await this.#objectGatewayClient.putBuffer(storageClusterId, {
            bucket: TEAM_CLUSTER_BUCKETS.LATEX_ASSETS,
            objectKey: storageKey,
            buffer,
            contentLength: buffer.byteLength,
            contentType: mimetype
        });

        await LatexAssetModel.create({
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
}
