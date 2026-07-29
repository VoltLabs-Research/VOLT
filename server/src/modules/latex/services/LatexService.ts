import eventBus from '@shared/infrastructure/events/RedisEventBus';
import tempFileService from '@shared/infrastructure/services/TempFileService';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import LatexDocumentEntity from '@modules/latex/models/LatexDocument';
import LatexFileEntity from '@modules/latex/models/LatexFile';
import LatexAssetEntity from '@modules/latex/models/LatexAsset';
import CatalogFolderEntity from '@shared/infrastructure/persistence/models/CatalogFolder';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import {
    getDocumentCompileWorkDirSegment,
    prepareWorkDir,
    runCompiler,
    withDocumentCompileLock
} from '@modules/latex/services/LatexCompiler';
import {
    assertLatexAssetStorageKey,
    buildLatexAssetContentUrl,
    buildLatexAssetStorageKey,
    requireLatexStorageClusterId,
    sanitizeAssetPath
} from '@modules/latex/services/LatexAssetStorage';
import ApplicationError from '@shared/application/errors/ApplicationError';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import type {
    ITeamClusterObjectGatewayClient,
    ITeamClusterSelectionService
} from '@shared/contracts/ports';
import ClusterObjectArchiveService from '@modules/cluster/services/ClusterObjectArchiveService';
import ClusterObjectSignedUrlService from '@modules/cluster/services/ClusterObjectSignedUrlService';
import objectGatewayClient from '@modules/cluster/services/TeamClusterObjectGatewayClient';
import type { DownloadStreamOutput } from '@shared/contracts/types';
import { createDownloadStreamResponse, sanitizeDownloadName } from '@shared/infrastructure/http/responses/download-response';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import { ILike, IsNull } from 'typeorm';
import type { FindManyOptions, FindOptionsWhere } from 'typeorm';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import unzipper from 'unzipper';
import { v4 } from 'uuid';
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
    LatexDocument,
    LatexFile,
    LatexAsset,
    UploadLatexAssetResult,
    LatexFolder,
    LatexAssetUploadTarget
} from '@volt/contracts/modules/latex/domain';

const MAX_IMPORT_SIZE = 100 * 1024 * 1024;
const MAIN_TEX_FILENAME = 'main.tex';
const MAX_ASSET_SIZE = 50 * 1024 * 1024;
const DEFAULT_DOCUMENT_LIMIT = 500;
const DEFAULT_FOLDER_LIMIT = 500;

interface TeamScoped{ teamId: string }
interface DocumentScoped extends TeamScoped{ documentId: string }

const USER_REFERENCE_SELECT = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    avatar: true
};

const DOCUMENT_REFERENCE_OPTIONS = {
    relations: {
        createdByRef: true,
        lastEditedByRef: true
    },
    select: {
        createdByRef: USER_REFERENCE_SELECT,
        lastEditedByRef: USER_REFERENCE_SELECT
    }
} satisfies FindManyOptions<LatexDocumentEntity>;

const FILE_ORDER_OPTIONS = {
    isEntrypoint: 'DESC',
    createdAt: 'ASC'
} satisfies FindManyOptions<LatexFileEntity>['order'];

const escapeLikeInput = (value: string): string => value.replace(/[\\%_]/g, (match) => `\\${match}`);

const toDocumentView = (document: LatexDocumentEntity): LatexDocument => ({
    _id: document.id,
    title: document.title,
    folder: document.folder,
    createdBy: document.createdByRef ?? document.createdBy,
    lastEditedBy: document.lastEditedByRef ?? document.lastEditedBy,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt
}) as unknown as LatexDocument;

const toFileView = (file: LatexFileEntity): LatexFile => ({
    _id: file.id,
    documentId: file.document,
    name: file.name,
    path: file.path,
    content: file.content,
    isEntrypoint: file.isEntrypoint,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt
}) as unknown as LatexFile;

const toFolderView = (folder: CatalogFolderEntity): LatexFolder => ({
    _id: folder.id,
    title: folder.title,
    parent: folder.parent,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt
}) as unknown as LatexFolder;

export default class LatexService{
    #signedUrlService = new ClusterObjectSignedUrlService();
    #archiveService = new ClusterObjectArchiveService();

    #objectGatewayClient: ITeamClusterObjectGatewayClient = objectGatewayClient;

    #teamClusterSelectionService: ITeamClusterSelectionService = teamClusterSelectionService;

    #tempFileService = tempFileService;

    #eventBus = eventBus;

    async listDocuments(input: TeamScoped & { page?: number; limit?: number; search?: string; folderId?: string }): Promise<PaginatedResult<LatexDocument>>{
        const pageRequest = readPageRequest(input.page, input.limit, { defaultLimit: DEFAULT_DOCUMENT_LIMIT });

        const where: FindOptionsWhere<LatexDocumentEntity> = { team: input.teamId };
        if(input.search){
            where.title = ILike(`%${escapeLikeInput(input.search)}%`);
        }
        if(input.folderId){
            where.folder = input.folderId === 'root' ? IsNull() : input.folderId;
        }

        const [documents, total] = await LatexDocumentEntity.findAndCount({
            where,
            order: { updatedAt: 'DESC' },
            skip: skipFor(pageRequest),
            take: pageRequest.limit,
            ...DOCUMENT_REFERENCE_OPTIONS
        });

        return paginate([documents.map((document) => toDocumentView(document)), total], pageRequest);
    }

    async createDocument(input: CreateLatexDocumentInput & TeamScoped & { userId: string }): Promise<LatexDocument>{
        const title = input.title?.trim();
        if(!title){
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'Document title is required');
        }

        if(input.folderId){
            await this.#requireFolder(input.teamId, input.folderId);
        }

        const storageClusterId = await this.#teamClusterSelectionService.resolveStorageClusterId(input.teamId);

        const document = await LatexDocumentEntity.create({
            team: input.teamId,
            title,
            storageClusterId,
            createdBy: input.userId,
            lastEditedBy: input.userId,
            folder: input.folderId ?? null
        }).save();

        await this.#eventBus.emit('latex-document.created', {
            documentId: document.id,
            teamId: input.teamId,
            userId: input.userId,
            documentTitle: document.title ?? ''
        });

        return toDocumentView(document);
    }

    async getDocument(input: DocumentScoped): Promise<LatexDocument>{
        const document = await this.#requireDocument(input.teamId, input.documentId);
        return toDocumentView(document);
    }

    async updateDocument(input: UpdateLatexDocumentInput & DocumentScoped & { userId?: string }): Promise<LatexDocument>{
        const document = await this.#requireDocument(input.teamId, input.documentId);

        const patch: Record<string, unknown> = {
            updatedAt: new Date(),
            ...(input.userId === undefined ? {} : { lastEditedBy: input.userId })
        };
        if(input.title !== undefined){
            patch.title = input.title.trim();
        }

        const updated = await Object.assign(document, patch).save();
        return toDocumentView(updated);
    }

    async deleteDocument(input: DocumentScoped & { userId?: string }): Promise<void>{
        const document = await this.#requireDocument(input.teamId, input.documentId);

        await LatexDocumentEntity.delete({ id: input.documentId });

        await this.#eventBus.emit('latex-document.deleted', {
            documentId: input.documentId,
            teamId: input.teamId,
            storageClusterId: document.storageClusterId ?? undefined,
            userId: input.userId ?? '',
            documentTitle: document.title ?? ''
        });
    }

    async moveDocument(input: DocumentScoped & { folderId: string | null }): Promise<null>{
        try{
            const document = await LatexDocumentEntity.findOneBy({
                id: input.documentId,
                team: input.teamId
            });
            if(!document){
                throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LaTeX document not found');
            }

            if(input.folderId !== null){
                await this.#requireFolder(input.teamId, input.folderId, 'Target LaTeX folder not found');
            }

            await LatexDocumentEntity.update({ id: input.documentId }, { folder: input.folderId });
            return null;
        }catch(error){
            if(error instanceof ApplicationError){
                throw error;
            }
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to move LaTeX document', 500);
        }
    }

    async importDocument(input: TeamScoped & { userId: string; file: Express.Multer.File; folderId?: string | null }): Promise<LatexDocument>{
        if(!input.file?.buffer?.length){
            throw ApplicationError.badRequest(ErrorCodes.FILE_READ_ERROR, 'No file provided or file is empty');
        }
        if(input.file.size > MAX_IMPORT_SIZE){
            throw ApplicationError.badRequest(ErrorCodes.FILE_READ_ERROR, 'File exceeds the 100MB import size limit');
        }

        if(input.folderId){
            await this.#requireFolder(input.teamId, input.folderId, 'Target LaTeX folder not found');
        }

        const mimetype = input.file.mimetype ?? '';
        const originalName = input.file.originalname ?? 'imported';
        const ext = path.extname(originalName).toLowerCase();
        const isZip = ext === '.zip' || mimetype === 'application/zip' || mimetype === 'application/x-zip-compressed';
        const isPdf = ext === '.pdf' || mimetype === 'application/pdf';
        const storageClusterId = await this.#teamClusterSelectionService.resolveStorageClusterId(input.teamId);

        if(isZip){
            return this.#importFromZip(input, storageClusterId);
        }
        if(isPdf){
            return this.#importFromPdf(input, storageClusterId);
        }
        return this.#importFromTex(input, storageClusterId);
    }

    async listAssets(input: DocumentScoped): Promise<LatexAsset[]>{
        await this.#requireDocument(input.teamId, input.documentId);

        const assets = await this.#findAssetsByDocument(input.documentId);
        return assets.map((asset) => this.#toAssetView(input.teamId, input.documentId, asset));
    }

    async getAssetContent(input: DocumentScoped & { key: string }): Promise<{ stream: Readable; contentType?: string; contentLength?: number; contentEncoding?: string }>{
        const document = await this.#requireDocument(input.teamId, input.documentId);
        const storageClusterId = requireLatexStorageClusterId(document.id, document);
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

    async uploadAsset(input: UploadLatexAssetInput & DocumentScoped & { userId: string }): Promise<UploadLatexAssetResult>{
        const validFiles = (input.files ?? [])
            .map((file, uploadIndex) => ({
                file,
                uploadIndex
            }))
            .filter(({ file }) => file && file.name && file.size >= 0);

        if(validFiles.length === 0){
            throw ApplicationError.badRequest(ErrorCodes.FILE_READ_ERROR, 'No valid files provided');
        }

        const document = await this.#requireDocument(input.teamId, input.documentId);
        const storageClusterId = requireLatexStorageClusterId(document.id, document);

        const uploaded: LatexAssetUploadTarget[] = [];
        let failedCount = 0;

        for(const { file, uploadIndex } of validFiles){
            if(file.size > MAX_ASSET_SIZE){
                failedCount++;
                continue;
            }

            try{
                const ext = path.extname(file.name);
                const storageKey = buildLatexAssetStorageKey(input.teamId, input.documentId, v4(), ext);
                const mimetype = file.type || 'application/octet-stream';
                const assetPath = sanitizeAssetPath(input.path ?? file.name, file.name);
                const url = buildLatexAssetContentUrl(input.teamId, input.documentId, storageKey);

                const asset = await LatexAssetEntity.create({
                    team: input.teamId,
                    document: input.documentId,
                    originalName: file.name,
                    path: assetPath,
                    storageKey,
                    url,
                    mimetype,
                    size: file.size,
                    createdBy: input.userId
                }).save();

                const signed = this.#signedUrlService.createToken({
                    kind: 'cluster-object',
                    operation: 'write',
                    teamId: input.teamId,
                    userId: input.userId,
                    ownerClusterId: storageClusterId,
                    bucket: TEAM_CLUSTER_BUCKETS.LATEX_ASSETS,
                    objectKey: storageKey,
                    resourceKind: 'latex-asset',
                    resourceId: asset.id,
                    contentLength: file.size,
                    contentType: mimetype
                });

                uploaded.push({
                    _id: asset.id,
                    uploadIndex,
                    documentId: asset.document,
                    originalName: asset.originalName,
                    path: asset.path,
                    url: buildLatexAssetContentUrl(input.teamId, input.documentId, asset.storageKey),
                    mimetype: asset.mimetype,
                    size: asset.size,
                    createdAt: asset.createdAt as unknown as string,
                    uploadUrl: signed.url,
                    expiresAt: signed.expiresAt
                });
            }catch{
                failedCount++;
            }
        }

        return {
            uploaded,
            failedCount,
            total: validFiles.length
        };
    }

    async deleteAsset(input: DocumentScoped & { assetId: string }): Promise<void>{
        const document = await this.#requireDocument(input.teamId, input.documentId);
        const storageClusterId = requireLatexStorageClusterId(document.id, document);

        const asset = await LatexAssetEntity.findOneBy({
            id: input.assetId,
            document: input.documentId
        });
        if(!asset){
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LaTeX asset not found');
        }

        try{
            await this.#objectGatewayClient.deleteObject(storageClusterId, TEAM_CLUSTER_BUCKETS.LATEX_ASSETS, asset.storageKey);
        }catch(error){
            if(!(error instanceof ApplicationError) || error.statusCode !== 404){
                throw error;
            }
        }
        await LatexAssetEntity.delete({ id: input.assetId });
    }

    async updateAsset(input: DocumentScoped & { assetId: string; path: string }): Promise<LatexAsset>{
        await this.#requireDocument(input.teamId, input.documentId);

        const asset = await LatexAssetEntity.findOneBy({
            id: input.assetId,
            document: input.documentId
        });
        if(!asset){
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LaTeX asset not found');
        }

        const safePath = sanitizeAssetPath(input.path, asset.originalName);
        const updated = await Object.assign(asset, {
            path: safePath,
            updatedAt: new Date()
        }).save();
        return this.#toAssetView(input.teamId, input.documentId, updated);
    }

    async exportDocumentTex(input: DocumentScoped): Promise<DownloadStreamOutput>{
        const document = await this.#requireDocument(input.teamId, input.documentId);

        const files = await this.#findFilesByDocument(input.documentId);
        const entrypoint = files.find((file) => file.isEntrypoint)
            ?? files.find((file) => file.name.toLowerCase().endsWith('.tex'))
            ?? null;

        if(!entrypoint){
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

    async exportDocumentZip(input: DocumentScoped): Promise<DownloadStreamOutput>{
        const document = await this.#requireDocument(input.teamId, input.documentId);
        const storageClusterId = requireLatexStorageClusterId(document.id, document);

        const [latexFiles, assets] = await Promise.all([
            this.#findFilesByDocument(input.documentId),
            this.#findAssetsByDocument(input.documentId)
        ]);

        const safeName = sanitizeDownloadName(document.title, 'document');

        if(latexFiles.length === 0){
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

    async compileDocument(input: DocumentScoped): Promise<DownloadStreamOutput>{
        const workDir = this.#tempFileService.getDirPath(
            getDocumentCompileWorkDirSegment(input.teamId, input.documentId)
        );

        return withDocumentCompileLock(input.teamId, input.documentId, async () => {
            const preparation = await prepareWorkDir(
                {
                    teamId: input.teamId,
                    documentId: input.documentId,
                    workDir,
                    haltOnError: true
                },
                {
                    objectGatewayClient: this.#objectGatewayClient,
                    tempFileService: this.#tempFileService
                }
            );

            if(preparation.status === 'no-document'){
                throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LaTeX document not found');
            }
            if(preparation.status === 'no-files'){
                throw new ApplicationError(ErrorCodes.LATEX_COMPILATION_FAILED, 'This document has no LaTeX files. Create main.tex before compiling.', 422);
            }
            if(preparation.status === 'no-entrypoint'){
                throw new ApplicationError(ErrorCodes.LATEX_COMPILATION_FAILED, 'No .tex file was found in this document. Add or select a .tex file to compile.', 422);
            }
            if(preparation.status === 'no-compiler'){
                throw new ApplicationError(ErrorCodes.LATEX_COMPILER_NOT_FOUND, 'No LaTeX compiler is available on this server. Install texlive (textlive-full) (latexmk, pdflatex, xelatex, or lualatex) to enable PDF compilation.', 503);
            }

            const result = await runCompiler(preparation.compiler, workDir);
            if(!result.success){
                throw new ApplicationError(ErrorCodes.LATEX_COMPILATION_FAILED, result.log || 'LaTeX compilation failed with no output.', 422);
            }

            const entrypointBaseName = path.parse(preparation.entrypointFilename).name;
            const pdfName = `${entrypointBaseName}.pdf`;
            const entrypointDir = path.dirname(preparation.entrypointFilename);
            const pdfCandidates = [path.join(workDir, pdfName)];
            if(entrypointDir !== '.'){
                pdfCandidates.push(path.join(workDir, entrypointDir, pdfName));
            }

            let pdfBuffer: Buffer | null = null;
            for(const candidate of pdfCandidates){
                try{
                    pdfBuffer = await fs.readFile(candidate);
                    break;
                }catch(err){
                    if((err as NodeJS.ErrnoException).code !== 'ENOENT'){
                        throw err;
                    }
                }
            }

            if(!pdfBuffer){
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

    async listFiles(input: DocumentScoped): Promise<LatexFile[]>{
        await this.#requireDocument(input.teamId, input.documentId);
        const files = await this.#findFilesByDocument(input.documentId);
        return files.map((file) => toFileView(file));
    }

    async createFile(input: CreateLatexFileInput & DocumentScoped & { userId: string }): Promise<LatexFile>{
        await this.#requireDocument(input.teamId, input.documentId);

        if(input.isEntrypoint){
            await this.#clearEntrypointForDocument(input.documentId);
        }

        const file = await LatexFileEntity.create({
            document: input.documentId,
            team: input.teamId,
            name: input.name.trim(),
            path: input.path ?? '',
            content: input.content ?? '',
            isEntrypoint: input.isEntrypoint ?? false,
            createdBy: input.userId
        }).save();

        return toFileView(file);
    }

    async updateFile(input: UpdateLatexFileInput & DocumentScoped & { fileId: string; source?: 'ai' | 'editor' }): Promise<LatexFile>{
        await this.#requireDocument(input.teamId, input.documentId);

        const existing = await LatexFileEntity.findOneBy({
            id: input.fileId,
            document: input.documentId
        });
        if(!existing){
            throw ApplicationError.notFound(ErrorCodes.LATEX_FILE_NOT_FOUND, 'LaTeX file not found');
        }

        const patch: Record<string, unknown> = { updatedAt: new Date() };
        if(input.name !== undefined) patch.name = input.name.trim();
        if(input.path !== undefined) patch.path = input.path;
        if(input.content !== undefined) patch.content = input.content;

        const updated = await Object.assign(existing, patch).save();

        if(input.source === 'ai' && input.content !== undefined){
            await this.#eventBus.emit('latex-file.content.updated', {
                documentId: input.documentId,
                teamId: input.teamId,
                fileId: input.fileId,
                content: input.content
            });
        }

        return toFileView(updated);
    }

    async deleteFile(input: DocumentScoped & { fileId: string }): Promise<void>{
        await this.#requireDocument(input.teamId, input.documentId);

        const file = await LatexFileEntity.findOneBy({
            id: input.fileId,
            document: input.documentId
        });
        if(!file){
            throw ApplicationError.notFound(ErrorCodes.LATEX_FILE_NOT_FOUND, 'LaTeX file not found');
        }

        if(file.isEntrypoint){
            const remainingFiles = (await this.#findFilesByDocument(input.documentId))
                .filter((currentFile) => currentFile.id !== input.fileId);

            if(remainingFiles.length > 0){
                const nextEntrypoint = remainingFiles.find((currentFile) =>
                    currentFile.name.toLowerCase().endsWith('.tex')
                ) ?? remainingFiles[0];

                await this.#clearEntrypointForDocument(input.documentId);
                await Object.assign(nextEntrypoint, {
                    isEntrypoint: true,
                    updatedAt: new Date()
                }).save();
            }
        }

        await LatexFileEntity.delete({ id: input.fileId });
    }

    async setFileEntrypoint(input: DocumentScoped & { fileId: string }): Promise<LatexFile>{
        await this.#requireDocument(input.teamId, input.documentId);

        const file = await LatexFileEntity.findOneBy({
            id: input.fileId,
            document: input.documentId
        });
        if(!file){
            throw ApplicationError.notFound(ErrorCodes.LATEX_FILE_NOT_FOUND, 'LaTeX file not found');
        }

        await this.#clearEntrypointForDocument(input.documentId);
        const updated = await Object.assign(file, {
            isEntrypoint: true,
            updatedAt: new Date()
        }).save();
        return toFileView(updated);
    }

    async listFolders(input: TeamScoped & { parentId?: string; page?: number; limit?: number }): Promise<PaginatedResult<LatexFolder>>{
        const pageRequest = readPageRequest(input.page, input.limit, { defaultLimit: DEFAULT_FOLDER_LIMIT });

        const [folders, total] = await CatalogFolderEntity.findAndCount({
            where: {
                team: input.teamId,
                kind: CatalogFolderKind.Latex,
                parent: input.parentId ?? IsNull()
            },
            order: { createdAt: 'DESC' },
            skip: skipFor(pageRequest),
            take: pageRequest.limit
        });

        return paginate([folders.map((folder) => toFolderView(folder)), total], pageRequest);
    }

    async getFolder(input: TeamScoped & { folderId: string }): Promise<LatexFolder>{
        const folder = await this.#requireFolder(input.teamId, input.folderId);
        return toFolderView(folder);
    }

    async createFolder(input: CreateLatexFolderInput & TeamScoped & { userId: string }): Promise<LatexFolder>{
        const folder = await CatalogFolderEntity.create({
            team: input.teamId,
            createdBy: input.userId,
            title: input.title,
            parent: input.parentId ?? null,
            kind: CatalogFolderKind.Latex
        }).save();
        return toFolderView(folder);
    }

    async updateFolder(input: UpdateLatexFolderInput & TeamScoped & { folderId: string }): Promise<LatexFolder>{
        const folder = await this.#requireFolder(input.teamId, input.folderId);
        const updated = await Object.assign(folder, {
            title: input.title,
            updatedAt: new Date()
        }).save();
        return toFolderView(updated);
    }

    async deleteFolder(input: TeamScoped & { folderId: string }): Promise<void>{
        try{
            await this.#requireFolder(input.teamId, input.folderId);
            await this.#deleteFolderTree(input.teamId, input.folderId);
        }catch(error){
            if(error instanceof ApplicationError){
                throw error;
            }
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to delete LaTeX folder', 500);
        }
    }

    async deleteAllDocumentsForTeam(teamId: string, userId: string): Promise<void>{
        const documents = await LatexDocumentEntity.find({
            where: { team: teamId },
            select: { id: true }
        });
        for(const document of documents){
            await this.deleteDocument({
                teamId,
                documentId: document.id,
                userId
            });
        }
    }

    async #requireDocument(teamId: string, documentId: string): Promise<LatexDocumentEntity>{
        const document = await LatexDocumentEntity.findOneBy({
            id: documentId,
            team: teamId
        });
        if(!document){
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'LaTeX document not found');
        }
        return document;
    }

    async #requireFolder(teamId: string, folderId: string, message = 'LaTeX folder not found'): Promise<CatalogFolderEntity>{
        const folder = await CatalogFolderEntity.findOneBy({
            id: folderId,
            team: teamId,
            kind: CatalogFolderKind.Latex
        });
        if(!folder){
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, message);
        }
        return folder;
    }

    async #findFilesByDocument(documentId: string): Promise<LatexFileEntity[]>{
        return LatexFileEntity.find({
            where: { document: documentId },
            order: FILE_ORDER_OPTIONS
        });
    }

    async #findAssetsByDocument(documentId: string): Promise<LatexAssetEntity[]>{
        return LatexAssetEntity.find({
            where: { document: documentId },
            order: { createdAt: 'DESC' }
        });
    }

    async #clearEntrypointForDocument(documentId: string): Promise<void>{
        await LatexFileEntity.update({
            document: documentId,
            isEntrypoint: true
        }, { isEntrypoint: false });
    }

    #toAssetView(teamId: string, documentId: string, asset: LatexAssetEntity): LatexAsset{
        return {
            _id: asset.id,
            documentId: asset.document,
            originalName: asset.originalName,
            path: asset.path,
            url: buildLatexAssetContentUrl(teamId, documentId, asset.storageKey),
            mimetype: asset.mimetype,
            size: asset.size,
            createdAt: asset.createdAt as unknown as string
        };
    }

    async #deleteFolderTree(teamId: string, folderId: string): Promise<void>{
        const subfolders = await CatalogFolderEntity.findBy({
            team: teamId,
            parent: folderId,
            kind: CatalogFolderKind.Latex
        });
        for(const subfolder of subfolders){
            await this.#deleteFolderTree(teamId, subfolder.id);
        }

        const documents = await LatexDocumentEntity.find({
            where: {
                team: teamId,
                folder: folderId
            },
            select: { id: true }
        });
        for(const document of documents){
            await this.deleteDocument({
                teamId,
                documentId: document.id
            });
        }

        await CatalogFolderEntity.delete({
            id: folderId,
            team: teamId,
            kind: CatalogFolderKind.Latex
        });
    }

    #deriveTitle(filename: string): string{
        const base = path.basename(filename, path.extname(filename));
        const cleaned = base.trim().replace(/[_-]+/g, ' ');
        return cleaned || 'Imported Document';
    }

    async #importFromTex(input: { teamId: string; userId: string; file: Express.Multer.File; folderId?: string | null }, storageClusterId: string): Promise<LatexDocument>{
        const content = input.file.buffer.toString('utf-8');
        const title = this.#deriveTitle(input.file.originalname);

        const document = await LatexDocumentEntity.create({
            team: input.teamId,
            title,
            folder: input.folderId ?? null,
            storageClusterId,
            createdBy: input.userId,
            lastEditedBy: null
        }).save();

        await LatexFileEntity.create({
            document: document.id,
            team: input.teamId,
            name: MAIN_TEX_FILENAME,
            path: '',
            content,
            isEntrypoint: true,
            createdBy: input.userId
        }).save();

        return toDocumentView(document);
    }

    async #importFromZip(input: { teamId: string; userId: string; file: Express.Multer.File; folderId?: string | null }, storageClusterId: string): Promise<LatexDocument>{
        let directory: unzipper.CentralDirectory;
        try{
            directory = await unzipper.Open.buffer(input.file.buffer);
        }catch{
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'Invalid ZIP archive');
        }

        const mainTexFile = directory.files.find(
            (f) => f.path === MAIN_TEX_FILENAME || f.path.endsWith(`/${MAIN_TEX_FILENAME}`)
        );
        if(!mainTexFile){
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'ZIP archive must contain a main.tex file');
        }

        const mainTexBuffer = await mainTexFile.buffer();
        const content = mainTexBuffer.toString('utf-8');
        const title = this.#deriveTitle(input.file.originalname);

        const document = await LatexDocumentEntity.create({
            team: input.teamId,
            title,
            folder: input.folderId ?? null,
            storageClusterId,
            createdBy: input.userId,
            lastEditedBy: null
        }).save();
        const documentId = document.id;

        await LatexFileEntity.create({
            document: documentId,
            team: input.teamId,
            name: MAIN_TEX_FILENAME,
            path: '',
            content,
            isEntrypoint: true,
            createdBy: input.userId
        }).save();

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

                await LatexFileEntity.create({
                    document: documentId,
                    team: input.teamId,
                    name: fileName,
                    path: filePath,
                    content: fileContent,
                    isEntrypoint: false,
                    createdBy: input.userId
                }).save();
            })
        );

        await Promise.allSettled(
            assetFiles.map((assetFile) => this.#uploadAssetFromZipEntry(assetFile, documentId, storageClusterId, input.teamId, input.userId))
        );

        return toDocumentView(document);
    }

    async #importFromPdf(input: { teamId: string; userId: string; file: Express.Multer.File; folderId?: string | null }, storageClusterId: string): Promise<LatexDocument>{
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

        const document = await LatexDocumentEntity.create({
            team: input.teamId,
            title,
            folder: input.folderId ?? null,
            storageClusterId,
            createdBy: input.userId,
            lastEditedBy: null
        }).save();
        const documentId = document.id;
        const storageKey = buildLatexAssetStorageKey(input.teamId, documentId, v4(), ext);
        const url = buildLatexAssetContentUrl(input.teamId, documentId, storageKey);

        await this.#objectGatewayClient.putBuffer(storageClusterId, {
            bucket: TEAM_CLUSTER_BUCKETS.LATEX_ASSETS,
            objectKey: storageKey,
            buffer: input.file.buffer,
            contentLength: input.file.buffer.byteLength,
            contentType: mimetype
        });

        await LatexFileEntity.create({
            document: documentId,
            team: input.teamId,
            name: MAIN_TEX_FILENAME,
            path: '',
            content: mainTexContent,
            isEntrypoint: true,
            createdBy: input.userId
        }).save();

        await LatexAssetEntity.create({
            team: input.teamId,
            document: documentId,
            originalName,
            path: originalName,
            storageKey,
            url,
            mimetype,
            size: input.file.buffer.byteLength,
            createdBy: input.userId
        }).save();

        return toDocumentView(document);
    }

    async #uploadAssetFromZipEntry(
        assetFile: unzipper.File,
        documentId: string,
        storageClusterId: string,
        teamId: string,
        userId: string
    ): Promise<void>{
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

        await LatexAssetEntity.create({
            team: teamId,
            document: documentId,
            originalName,
            path: assetPath,
            storageKey,
            url,
            mimetype,
            size: buffer.byteLength,
            createdBy: userId
        }).save();
    }
}
