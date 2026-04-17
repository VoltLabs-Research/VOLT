import type { LatexFileDTO } from './LatexFileDTO';
import type { TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type ListLatexFilesInputDTO = TeamScopedEntityIdInputDTO<'documentId'>;

export type ListLatexFilesOutputDTO = LatexFileDTO[];
