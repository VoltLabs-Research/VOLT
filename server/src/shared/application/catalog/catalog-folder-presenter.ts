import type { CatalogFolderEntity, CatalogFolderProps } from '@shared/domain/catalog/CatalogFolder';
import type { CatalogFolderView } from './catalog-folder-view';

export const presentCatalogFolder = <TFolder extends CatalogFolderEntity<TProps>, TProps extends CatalogFolderProps>(
    folder: TFolder
): CatalogFolderView => {
    return {
        _id: folder._id,
        title: folder.props.title,
        parent: folder.props.parent,
        createdAt: folder.props.createdAt,
        updatedAt: folder.props.updatedAt
    };
};
