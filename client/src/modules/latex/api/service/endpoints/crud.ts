import { paginated, get, post, del, patch } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { LatexDocument } from '@/modules/latex/api/entities/latex-document';
import type { GetLatexDocumentParams } from '../../dtos/get-latex-document';
import type { ListLatexDocumentsParams } from '../../dtos/list-latex-documents';
import type { CreateLatexDocumentParams } from '../../dtos/create-latex-document';
import type { DeleteLatexDocumentParams } from '../../dtos/delete-latex-document';
import type { UpdateLatexDocumentParams } from '../../dtos/update-latex-document';
import type { MoveLatexDocumentParams } from '../../dtos/move-latex-document';

const endpoints = {
    listDocuments: paginated<ListLatexDocumentsParams, PaginatedResponse<LatexDocument>>(
        '/documents'
    ),
    createDocument: post<CreateLatexDocumentParams, LatexDocument>('/documents', {
        body: ({ title, folderId }) => ({ title, folderId })
    }),
    getDocument: get<GetLatexDocumentParams, LatexDocument>('/documents/:documentId'),
    deleteDocument: del<DeleteLatexDocumentParams>('/documents/:documentId'),
    updateDocument: patch<UpdateLatexDocumentParams, LatexDocument>('/documents/:documentId', {
        body: ({ title }) => ({ title })
    }),
    moveDocument: patch<MoveLatexDocumentParams, LatexDocument>('/documents/:documentId/folder', {
        body: ({ folderId }) => ({ folderId })
    })
};

export default endpoints;
