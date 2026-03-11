import { download, request } from '@/app/core/http/utilities/create-service';
import { buildFileFormData } from '@/shared/utils/file';
import type { ExportLatexDocumentParams } from '@/modules/latex/api/dtos/export-latex-document';
import type { ImportLatexDocumentParams, ImportLatexDocumentResult } from '@/modules/latex/api/dtos/import-latex-document';
import type { CompileLatexDocumentParams } from '@/modules/latex/api/dtos/compile-latex-document';

const transferEndpoints = {
    exportDocumentTex: download<ExportLatexDocumentParams>('GET', '/documents/:documentId/export/tex'),
    exportDocumentZip: download<ExportLatexDocumentParams>('GET', '/documents/:documentId/export/zip'),
    importDocument: request<ImportLatexDocumentParams, ImportLatexDocumentResult>('POST', '/import', {
        body: ({ file, folderId }) => buildFileFormData(
            [{ name: 'file', file }],
            folderId ? { folderId } : undefined
        ),
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    compileDocument: download<CompileLatexDocumentParams>('POST', '/documents/:documentId/compile')
};

export default transferEndpoints;
