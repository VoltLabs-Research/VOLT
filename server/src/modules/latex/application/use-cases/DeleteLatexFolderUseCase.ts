import { DeleteLatexDocumentUseCase } from '@modules/latex/application/use-cases/DeleteLatexDocumentUseCase';
import type { LatexDocumentProps } from '@modules/latex/domain/entities/LatexDocument';
import LatexDocument from '@modules/latex/domain/entities/LatexDocument';
import type LatexFolder from '@modules/latex/domain/entities/LatexFolder';
import type { LatexFolderProps } from '@modules/latex/domain/entities/LatexFolder';
import LatexDocumentRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexDocumentRepository';
import LatexFolderRepository from '@modules/latex/infrastructure/persistence/mongo/repositories/LatexFolderRepository';
import { DeleteCatalogFolderUseCase } from '@shared/application/catalog/DeleteCatalogFolderUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';

@Singleton()
export class DeleteLatexFolderUseCase extends DeleteCatalogFolderUseCase<LatexFolder, LatexFolderProps, LatexDocument, LatexDocumentProps> {
    constructor(
        
        latexFolderRepository: LatexFolderRepository,
        
        latexDocumentRepository: LatexDocumentRepository,
        
        deleteLatexDocumentUseCase: DeleteLatexDocumentUseCase
    ) {
        super(
            latexFolderRepository,
            latexDocumentRepository,
            async (document, teamId) => {
                const result = await deleteLatexDocumentUseCase.execute({
                    teamId,
                    documentId: document._id
                });

                if (!result.success) {
                    throw result.error;
                }
            },
            { folderLabel: 'LaTeX folder' }
        );
    }
}
