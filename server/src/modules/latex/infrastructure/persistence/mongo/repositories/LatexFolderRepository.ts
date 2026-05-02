import type LatexFolder from '@modules/latex/domain/entities/LatexFolder';
import type { LatexFolderProps } from '@modules/latex/domain/entities/LatexFolder';
import type { ILatexFolderRepository } from '@modules/latex/domain/port/ILatexFolderRepository';
import latexFolderMapper from '@modules/latex/infrastructure/persistence/mongo/mappers/LatexFolderMapper';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseCatalogFolderRepository } from '@shared/infrastructure/persistence/mongo/MongooseCatalogFolderRepository';
import CatalogFolderModel, { type CatalogFolderDocument } from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';

@Singleton()
export default class LatexFolderRepository
    extends MongooseCatalogFolderRepository<LatexFolder, LatexFolderProps, CatalogFolderDocument>
    implements ILatexFolderRepository {
    constructor() {
        super(CatalogFolderModel, latexFolderMapper, CatalogFolderKind.Latex);
    }
}
