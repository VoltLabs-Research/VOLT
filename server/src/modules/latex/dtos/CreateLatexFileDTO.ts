import type { LatexFileDTO } from './LatexFileDTO';
import type { TeamUserScopedEntityIdInputDTO } from '@modules/team/dtos/common';

export type CreateLatexFileInputDTO = TeamUserScopedEntityIdInputDTO<'documentId'> & {
    name: string;
    path?: string;
    content?: string;
    isEntrypoint?: boolean;
};

export type CreateLatexFileOutputDTO = LatexFileDTO;
