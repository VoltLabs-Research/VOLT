import eventBus from '@shared/infrastructure/events/RedisEventBus';
import { ErrorCodes } from '@core/constants/error-codes';
import LatexDocumentEntity from '@modules/latex/models/LatexDocument';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import CatalogFolderService from '@shared/domain/catalog/CatalogFolderService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import teamClusterSelectionService from '@modules/container/services/TeamClusterSelectionService';
import { paginate, readPageRequest, skipFor } from '@shared/infrastructure/persistence/paginate';
import type { PaginatedResult } from '@shared/domain/port/persistence';
import { ILike, IsNull } from 'typeorm';
import type { FindManyOptions, FindOptionsWhere } from 'typeorm';
import path from 'node:path';
import LatexDocumentImporter from '@modules/latex/services/LatexDocumentImporter';
import { toDocumentView } from '@modules/latex/services/latex-views';
import { requireDocument } from '@modules/latex/services/latex-queries';
import type {
    DocumentScoped,
    TeamScoped
} from '@modules/latex/services/latex-queries';
import type { LatexDocumentQuery } from '@modules/latex/contracts/queries';
import type { LatexDocumentImportRequest } from '@modules/latex/contracts/latex-document';
import { MAX_IMPORT_SIZE } from '@modules/latex/services/latex-constants';
import type {
    CreateLatexDocumentInput,
    UpdateLatexDocumentInput
} from '@volt/contracts/modules/latex/http';
import type { LatexDocument } from '@volt/contracts/modules/latex/domain';

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

export default class LatexDocumentService{
    #importer = new LatexDocumentImporter();

    #folders = new CatalogFolderService(CatalogFolderKind.Latex);

    async listDocuments(input: LatexDocumentQuery & TeamScoped): Promise<PaginatedResult<LatexDocument>>{
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
        const title = input.title.trim();
        if(!title){
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'Document title is required');
        }

        if(input.folderId){
            await this.#folders.require(input.teamId, input.folderId, 'LaTeX folder not found');
        }

        const storageClusterId = await teamClusterSelectionService.resolveStorageClusterId(input.teamId);

        const document = await LatexDocumentEntity.create({
            team: input.teamId,
            title,
            storageClusterId,
            createdBy: input.userId,
            lastEditedBy: input.userId,
            folder: input.folderId ?? null
        }).save();

        await eventBus.emit('latex-document.created', {
            documentId: document.id,
            teamId: input.teamId,
            userId: input.userId,
            documentTitle: document.title
        });

        return toDocumentView(document);
    }

    async getDocument(input: DocumentScoped): Promise<LatexDocument>{
        const document = await requireDocument(input.teamId, input.documentId);
        return toDocumentView(document);
    }

    async updateDocument(input: UpdateLatexDocumentInput & DocumentScoped & { userId: string }): Promise<LatexDocument>{
        const document = await requireDocument(input.teamId, input.documentId);

        const patch: Partial<LatexDocumentEntity> = {
            updatedAt: new Date(),
            lastEditedBy: input.userId
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

        await eventBus.emit('latex-document.deleted', {
            documentId: input.documentId,
            teamId: input.teamId,
            storageClusterId: document.storageClusterId ?? undefined,
            userId: input.userId ?? '',
            documentTitle: document.title
        });
    }

    async moveDocument(input: DocumentScoped & { folderId: string | null }): Promise<null>{
        await requireDocument(input.teamId, input.documentId);

        if(input.folderId !== null){
            await this.#folders.require(input.teamId, input.folderId, 'Target LaTeX folder not found');
        }

        await LatexDocumentEntity.update({ id: input.documentId }, { folder: input.folderId });
        return null;
    }

    async importDocument(input: LatexDocumentImportRequest): Promise<LatexDocument>{
        if(!input.file?.buffer?.length){
            throw ApplicationError.badRequest(ErrorCodes.FILE_READ_ERROR, 'No file provided or file is empty');
        }
        if(input.file.size > MAX_IMPORT_SIZE){
            throw ApplicationError.badRequest(ErrorCodes.FILE_READ_ERROR, 'File exceeds the 100MB import size limit');
        }

        if(input.folderId){
            await this.#folders.require(input.teamId, input.folderId, 'Target LaTeX folder not found');
        }

        const ext = path.extname(input.file.originalname).toLowerCase();
        const mimetype = input.file.mimetype;
        const isZip = ext === '.zip' || mimetype === 'application/zip' || mimetype === 'application/x-zip-compressed';
        const isPdf = ext === '.pdf' || mimetype === 'application/pdf';
        const storageClusterId = await teamClusterSelectionService.resolveStorageClusterId(input.teamId);

        if(isZip){
            return this.#importer.fromZip(input, storageClusterId);
        }
        if(isPdf){
            return this.#importer.fromPdf(input, storageClusterId);
        }
        return this.#importer.fromTex(input, storageClusterId);
    }

    async deleteFolder(input: TeamScoped & { folderId: string }): Promise<void>{
        await this.#folders.require(input.teamId, input.folderId, 'LaTeX folder not found');
        await this.#folders.removeTree(input.teamId, input.folderId, (folderId) => (
            this.#deleteTeamDocuments(input.teamId, folderId)
        ));
    }

    async deleteAllDocumentsForTeam(teamId: string, userId: string): Promise<void>{
        await this.#deleteTeamDocuments(teamId, undefined, userId);
    }

    async #deleteTeamDocuments(teamId: string, folderId?: string, userId?: string): Promise<void>{
        const documents = await LatexDocumentEntity.find({
            where: {
                team: teamId,
                ...(folderId === undefined ? {} : { folder: folderId })
            },
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
}
