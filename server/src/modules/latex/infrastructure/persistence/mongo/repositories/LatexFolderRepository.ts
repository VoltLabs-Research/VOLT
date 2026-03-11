import type { LatexFolderProps } from '@modules/latex/domain/entities/LatexFolder';
import type LatexFolder from '@modules/latex/domain/entities/LatexFolder';
import type { ILatexFolderRepository } from '@modules/latex/domain/port/ILatexFolderRepository';
import latexFolderMapper from '@modules/latex/infrastructure/persistence/mongo/mappers/LatexFolderMapper';
import LatexFolderModel, { type LatexFolderDocument } from '@modules/latex/infrastructure/persistence/mongo/models/LatexFolderModel';
import { MongooseCatalogFolderRepository } from '@shared/infrastructure/persistence/mongo/MongooseCatalogFolderRepository';
import { injectable } from 'tsyringe';

@injectable()
export default class LatexFolderRepository
    extends MongooseCatalogFolderRepository<LatexFolder, LatexFolderProps, LatexFolderDocument>
    implements ILatexFolderRepository {
    constructor() {
        super(LatexFolderModel, latexFolderMapper);
    }
}
