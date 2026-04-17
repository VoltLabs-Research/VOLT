import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import type { TeamScopedInputDTO } from '@modules/team/application/dtos/common';
import type { LatexDocumentDTO } from './LatexDocumentDTO';

export type ListLatexDocumentsInputDTO = TeamScopedInputDTO & {
    page?: number;
    limit?: number;
    search?: string;
    folderId?: string;
};

export type ListLatexDocumentsOutputDTO = PaginatedResult<LatexDocumentDTO>;
