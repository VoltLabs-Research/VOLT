import { get, post, patch, del } from '@/app/core/http/utilities/create-service';
import type { LatexFile } from '@/modules/latex/api/entities/latex-file';
import type { ListLatexFilesParams } from '@/modules/latex/api/dtos/list-latex-files';
import type { CreateLatexFileParams } from '@/modules/latex/api/dtos/create-latex-file';
import type { UpdateLatexFileParams } from '@/modules/latex/api/dtos/update-latex-file';
import type { DeleteLatexFileParams } from '@/modules/latex/api/dtos/delete-latex-file';
import type { SetLatexFileEntrypointParams } from '@/modules/latex/api/dtos/set-latex-file-entrypoint';

const fileEndpoints = {
    listFiles: get<ListLatexFilesParams, LatexFile[]>('/documents/:documentId/files'),
    createFile: post<CreateLatexFileParams, LatexFile>('/documents/:documentId/files', {
        body: ({ name, path, content, isEntrypoint }) => ({
            name,
            path,
            content,
            isEntrypoint
        })
    }),
    updateFile: patch<UpdateLatexFileParams, LatexFile>('/documents/:documentId/files/:fileId', {
        body: ({ name, path, content }) => ({ name, path, content })
    }),
    deleteFile: del<DeleteLatexFileParams>('/documents/:documentId/files/:fileId'),
    setFileEntrypoint: post<SetLatexFileEntrypointParams, LatexFile>(
        '/documents/:documentId/files/:fileId/entrypoint',
        { body: () => ({}) }
    )
};

export default fileEndpoints;
