import type { LatexFileDTO } from './LatexFileDTO';
import type { TeamScopedEntityIdInputDTO } from '@modules/team/dtos/common';

export type ListLatexFilesInputDTO = TeamScopedEntityIdInputDTO<'documentId'>;

export type ListLatexFilesOutputDTO = LatexFileDTO[];
