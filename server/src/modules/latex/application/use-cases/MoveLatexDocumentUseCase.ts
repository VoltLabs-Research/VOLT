import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import type LatexFolder from '@modules/latex/domain/entities/LatexFolder';
import type { LatexFolderProps } from '@modules/latex/domain/entities/LatexFolder';
import type { LatexDocumentProps } from '@modules/latex/domain/entities/LatexDocument';
import { inject, injectable } from 'tsyringe';
import { MoveCatalogItemUseCase } from '@shared/application/catalog/MoveCatalogItemUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type { ILatexFolderRepository } from '@modules/latex/domain/port/ILatexFolderRepository';
import type {
    MoveLatexDocumentInputDTO,
    MoveLatexDocumentOutputDTO
} from '@modules/latex/application/dtos/MoveLatexDocumentDTO';

@injectable()
export class MoveLatexDocumentUseCase
    extends MoveCatalogItemUseCase<MoveLatexDocumentInputDTO, LatexFolder, LatexFolderProps, LatexDocumentProps>
    implements IUseCase<MoveLatexDocumentInputDTO, MoveLatexDocumentOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository)
        latexDocumentRepository: ILatexDocumentRepository,

        @inject(LATEX_TOKENS.LatexFolderRepository)
        latexFolderRepository: ILatexFolderRepository
    ) {
        super(latexDocumentRepository, latexFolderRepository, {
            folderLabel: 'LaTeX folder',
            itemLabel: 'LaTeX document',
            getItemId: (input) => input.documentId
        });
    }
};
