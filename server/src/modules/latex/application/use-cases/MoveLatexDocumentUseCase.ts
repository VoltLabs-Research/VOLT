import type {
    MoveLatexDocumentInputDTO,
    MoveLatexDocumentOutputDTO
} from '@modules/latex/application/dtos/MoveLatexDocumentDTO';
import type { LatexDocumentProps } from '@modules/latex/domain/entities/LatexDocument';
import type LatexFolder from '@modules/latex/domain/entities/LatexFolder';
import type { LatexFolderProps } from '@modules/latex/domain/entities/LatexFolder';
import LatexDocumentRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexDocumentRepository';
import LatexFolderRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexFolderRepository';
import { MoveCatalogItemUseCase } from '@shared/application/catalog/MoveCatalogItemUseCase';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class MoveLatexDocumentUseCase
    extends MoveCatalogItemUseCase<MoveLatexDocumentInputDTO, LatexFolder, LatexFolderProps, LatexDocumentProps>
    implements IUseCase<MoveLatexDocumentInputDTO, MoveLatexDocumentOutputDTO, ApplicationError> {
    constructor(
        
        latexDocumentRepository: LatexDocumentRepository,

        
        latexFolderRepository: LatexFolderRepository
    ) {
        super(latexDocumentRepository, latexFolderRepository, {
            folderLabel: 'LaTeX folder',
            itemLabel: 'LaTeX document',
            getItemId: (input) => input.documentId
        });
    }
};
