import eventBus from '@shared/infrastructure/events/RedisEventBus';
import tempFileService from '@shared/infrastructure/services/TempFileService';
import { TEAM_CLUSTER_BUCKETS } from '@core/config/team-cluster-buckets';
import { ErrorCodes } from '@core/constants/error-codes';
import LatexDocumentEntity from '@modules/latex/models/LatexDocument';
import LatexFileEntity from '@modules/latex/models/LatexFile';
import CatalogFolderEntity from '@shared/infrastructure/persistence/models/CatalogFolder';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import {
    getDocumentCompileWorkDirSegment,
    prepareWorkDir,
    runCompiler,
    withDocumentCompileLock
} from '@modules/latex/services/LatexCompiler';
import {
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
import { v4 } from 'uuid';
import LatexDocumentImporter from '@modules/latex/services/LatexDocumentImporter';
import { toDocumentView } from '@modules/latex/services/latex-views';
import CatalogFolderService from '@shared/domain/catalog/CatalogFolderService';
import {
    findAssetsByDocument,
    findFilesByDocument,
    requireDocument
} from '@modules/latex/services/latex-queries';
import type {
    DocumentScoped,
    TeamScoped
} from '@modules/latex/services/latex-queries';
import {
    MAX_IMPORT_SIZE
} from '@modules/latex/services/latex-constants';
import type {
    CreateLatexDocumentInput,
    UpdateLatexDocumentInput,
    CreateLatexFileInput,
    UpdateLatexFileInput,
    CreateLatexFolderInput,
    UpdateLatexFolderInput
} from '@volt/contracts/modules/latex/http';
import type {
    LatexDocument,
    LatexFile,
    LatexFolder
} from '@volt/contracts/modules/latex/domain';

const DEFAULT_DOCUMENT_LIMIT = 500;


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

const escapeLikeInput = (value: string): string => value.replace(/[\\%_]/g, (match) => `\\${match}`);

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

export default class LatexService{
    #archiveService = new ClusterObjectArchiveService();

    #objectGatewayClient: ITeamClusterObjectGatewayClient = objectGatewayClient;

    #teamClusterSelectionService: ITeamClusterSelectionService = teamClusterSelectionService;

    #tempFileService = tempFileService;

    #eventBus = eventBus;

    #importer = new LatexDocumentImporter();
    #folders = new CatalogFolderService(CatalogFolderKind.Latex);

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
        const document = await requireDocument(input.teamId, input.documentId);
        return toDocumentView(document);
    }

    async updateDocument(input: UpdateLatexDocumentInput & DocumentScoped & { userId?: string }): Promise<LatexDocument>{
        const document = await requireDocument(input.teamId, input.documentId);

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
        const document = await requireDocument(input.teamId, input.documentId);

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
            return this.#importer.fromZip(input, storageClusterId);
        }
        if(isPdf){
            return this.#importer.fromPdf(input, storageClusterId);
        }
        return this.#importer.fromTex(input, storageClusterId);
    }

    async exportDocumentTex(input: DocumentScoped): Promise<DownloadStreamOutput>{
        const document = await requireDocument(input.teamId, input.documentId);

        const files = await findFilesByDocument(input.documentId);
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
        const document = await requireDocument(input.teamId, input.documentId);
        const storageClusterId = requireLatexStorageClusterId(document.id, document);

        const [latexFiles, assets] = await Promise.all([
            findFilesByDocument(input.documentId),
            findAssetsByDocument(input.documentId)
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
        await requireDocument(input.teamId, input.documentId);
        const files = await findFilesByDocument(input.documentId);
        return files.map((file) => toFileView(file));
    }

    async createFile(input: CreateLatexFileInput & DocumentScoped & { userId: string }): Promise<LatexFile>{
        await requireDocument(input.teamId, input.documentId);

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
        await requireDocument(input.teamId, input.documentId);

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
        await requireDocument(input.teamId, input.documentId);

        const file = await LatexFileEntity.findOneBy({
            id: input.fileId,
            document: input.documentId
        });
        if(!file){
            throw ApplicationError.notFound(ErrorCodes.LATEX_FILE_NOT_FOUND, 'LaTeX file not found');
        }

        if(file.isEntrypoint){
            const remainingFiles = (await findFilesByDocument(input.documentId))
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
        await requireDocument(input.teamId, input.documentId);

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
        return this.#folders.list(input.teamId, {
            parentId: input.parentId,
            page: input.page,
            limit: input.limit
        }) as unknown as Promise<PaginatedResult<LatexFolder>>;
    }

    async getFolder(input: TeamScoped & { folderId: string }): Promise<LatexFolder>{
        return this.#folders.get(input.teamId, input.folderId, 'LaTeX folder not found') as unknown as Promise<LatexFolder>;
    }

    async createFolder(input: CreateLatexFolderInput & TeamScoped & { userId: string }): Promise<LatexFolder>{
        return this.#folders.create(input.teamId, input.userId, {
            title: input.title,
            parentId: input.parentId
        }) as unknown as Promise<LatexFolder>;
    }

    async updateFolder(input: UpdateLatexFolderInput & TeamScoped & { folderId: string }): Promise<LatexFolder>{
        return this.#folders.update(input.teamId, input.folderId, input.title) as unknown as Promise<LatexFolder>;
    }

    async deleteFolder(input: TeamScoped & { folderId: string }): Promise<void>{
        try{
            await this.#folders.require(input.teamId, input.folderId, 'LaTeX folder not found');
            await this.#folders.removeTree(input.teamId, input.folderId, (folderId) => this.#deleteDocumentsInFolder(input.teamId, folderId));
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


    async #requireFolder(teamId: string, folderId: string, message = 'LaTeX folder not found'): Promise<CatalogFolderEntity>{
        return this.#folders.require(teamId, folderId, message);
    }



    async #clearEntrypointForDocument(documentId: string): Promise<void>{
        await LatexFileEntity.update({
            document: documentId,
            isEntrypoint: true
        }, { isEntrypoint: false });
    }

    async #deleteDocumentsInFolder(teamId: string, folderId: string): Promise<void>{
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
    }

}
