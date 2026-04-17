import type { LatexDocumentDTO } from './LatexDocumentDTO';
import type { TeamScopedEntityIdInputDTO } from '@modules/team/application/dtos/common';

export type GetLatexDocumentInputDTO = TeamScopedEntityIdInputDTO<'documentId'>;

export type GetLatexDocumentOutputDTO = LatexDocumentDTO;
