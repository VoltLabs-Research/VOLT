import { LATEX_TOKENS } from '@modules/latex/di/LatexTokens';
import type LatexFolder from '@modules/latex/entities/LatexFolder';
import type { LatexFolderProps } from '@modules/latex/entities/LatexFolder';
import type { ILatexFolderRepository } from '@modules/latex/ports/ILatexFolderRepository';
import latexFolderMapper from '@modules/latex/mappers/LatexFolderMapper';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseCatalogFolderRepository } from '@shared/infrastructure/persistence/mongo/MongooseCatalogFolderRepository';
import CatalogFolderModel, { type CatalogFolderDocument } from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';

@Singleton(LATEX_TOKENS.LatexFolderRepository)
export default class LatexFolderRepository
    extends MongooseCatalogFolderRepository<LatexFolder, LatexFolderProps, CatalogFolderDocument>
    implements ILatexFolderRepository {
    constructor() {
        super(CatalogFolderModel, latexFolderMapper, CatalogFolderKind.Latex);
    }
}
