import { del, get, paginated, patch, post } from '@/app/core/http/utilities/create-service';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { CreateLatexFolderParams } from '@/modules/latex/api/dtos/create-latex-folder';
import type { DeleteLatexFolderParams } from '@/modules/latex/api/dtos/delete-latex-folder';
import type { GetLatexFolderParams } from '@/modules/latex/api/dtos/get-latex-folder';
import type { ListLatexFoldersParams } from '@/modules/latex/api/dtos/list-latex-folders';
import type { UpdateLatexFolderParams } from '@/modules/latex/api/dtos/update-latex-folder';
import type { LatexFolder } from '@/modules/latex/api/entities/latex-folder';

const endpoints = {
    listFolders: paginated<ListLatexFoldersParams, PaginatedResponse<LatexFolder>>('/folders'),
    getFolder: get<GetLatexFolderParams, LatexFolder>('/folders/:folderId'),
    createFolder: post<CreateLatexFolderParams, LatexFolder>('/folders', {
        body: ({ title, parentId }) => ({ title, parentId })
    }),
    updateFolder: patch<UpdateLatexFolderParams, LatexFolder>('/folders/:folderId', {
        body: ({ title }) => ({ title })
    }),
    deleteFolder: del<DeleteLatexFolderParams>('/folders/:folderId')
};

export default endpoints;
