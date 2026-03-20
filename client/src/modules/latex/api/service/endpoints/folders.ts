import { createFolderCrudEndpoints } from '@/shared/api/folder-endpoints';
import type { CreateLatexFolderParams } from '@/modules/latex/api/dtos/create-latex-folder';
import type { DeleteLatexFolderParams } from '@/modules/latex/api/dtos/delete-latex-folder';
import type { GetLatexFolderParams } from '@/modules/latex/api/dtos/get-latex-folder';
import type { ListLatexFoldersParams } from '@/modules/latex/api/dtos/list-latex-folders';
import type { UpdateLatexFolderParams } from '@/modules/latex/api/dtos/update-latex-folder';
import type { LatexFolder } from '@/modules/latex/api/entities/latex-folder';

const endpoints = createFolderCrudEndpoints<
    ListLatexFoldersParams,
    GetLatexFolderParams,
    CreateLatexFolderParams,
    UpdateLatexFolderParams,
    DeleteLatexFolderParams,
    LatexFolder
>();

export default endpoints;
