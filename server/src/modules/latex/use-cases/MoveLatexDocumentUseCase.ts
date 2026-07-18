import type { ILatexFolderRepository } from '@modules/latex/ports/ILatexFolderRepository';
import { LATEX_TOKENS } from '@modules/latex/di/LatexTokens';
import type { ILatexDocumentRepository } from '@modules/latex/ports/ILatexDocumentRepository';
import type {
    MoveLatexDocumentInputDTO,
    MoveLatexDocumentOutputDTO
} from '@modules/latex/dtos/MoveLatexDocumentDTO';
import type { LatexDocumentProps } from '@modules/latex/entities/LatexDocument';
import type LatexFolder from '@modules/latex/entities/LatexFolder';
import type { LatexFolderProps } from '@modules/latex/entities/LatexFolder';
import { MoveCatalogItemUseCase } from '@shared/application/catalog/MoveCatalogItemUseCase';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class MoveLatexDocumentUseCase
    extends MoveCatalogItemUseCase<MoveLatexDocumentInputDTO, LatexFolder, LatexFolderProps, LatexDocumentProps>
    implements IUseCase<MoveLatexDocumentInputDTO, MoveLatexDocumentOutputDTO> {
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
