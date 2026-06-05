import type { ILatexFolderRepository } from '@modules/latex/domain/port/ILatexFolderRepository';
import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type {
    MoveLatexDocumentInputDTO,
    MoveLatexDocumentOutputDTO
} from '@modules/latex/application/dtos/MoveLatexDocumentDTO';
import type { LatexDocumentProps } from '@modules/latex/domain/entities/LatexDocument';
import type LatexFolder from '@modules/latex/domain/entities/LatexFolder';
import type { LatexFolderProps } from '@modules/latex/domain/entities/LatexFolder';
import { MoveCatalogItemUseCase } from '@shared/application/catalog/MoveCatalogItemUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class MoveLatexDocumentUseCase
    extends MoveCatalogItemUseCase<MoveLatexDocumentInputDTO, LatexFolder, LatexFolderProps, LatexDocumentProps>
    implements IUseCase<MoveLatexDocumentInputDTO, MoveLatexDocumentOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository) latexDocumentRepository: ILatexDocumentRepository,
        @inject(LATEX_TOKENS.LatexFolderRepository) latexFolderRepository: ILatexFolderRepository
    ) {
        super(latexDocumentRepository, latexFolderRepository, {
            folderLabel: 'LaTeX folder',
            itemLabel: 'LaTeX document',
            getItemId: (input) => input.documentId
        });
    }
}
