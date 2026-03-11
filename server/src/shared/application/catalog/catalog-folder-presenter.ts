import type { CatalogFolderEntity, CatalogFolderProps } from '@shared/domain/catalog/CatalogFolder';
import type { CatalogFolderDTO } from './catalog-folder-dto';

export const presentCatalogFolder = <TFolder extends CatalogFolderEntity<TProps>, TProps extends CatalogFolderProps>(
    folder: TFolder
): CatalogFolderDTO => {
    return {
        _id: folder._id,
        title: folder.props.title,
        parent: folder.props.parent,
        createdAt: folder.props.createdAt,
        updatedAt: folder.props.updatedAt
    };
};
