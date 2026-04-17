import type { LatexDocumentDTO } from './LatexDocumentDTO';
import type { TeamUserScopedInputDTO } from '@modules/team/application/dtos/common';

export type CreateLatexDocumentInputDTO = TeamUserScopedInputDTO & {
    title: string;
    folderId?: string | null;
};

export type CreateLatexDocumentOutputDTO = LatexDocumentDTO;
