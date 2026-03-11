import type { CatalogFolderEntity, CatalogFolderProps } from '@shared/domain/catalog/CatalogFolder';
import type { ICatalogFolderRepository } from '@shared/domain/catalog/ICatalogFolderRepository';
import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';

interface DeleteCatalogFolderTreeOptions<
    TFolder extends CatalogFolderEntity<TFolderProps>,
    TFolderProps extends CatalogFolderProps,
    TItem extends { _id: string },
    TItemProps extends object
> {
    teamId: string;
    folderId: string;
    folderRepository: ICatalogFolderRepository<TFolder, TFolderProps>;
    itemRepository: IBaseRepository<TItem, TItemProps>;
    deleteItem: (item: TItem, teamId: string) => Promise<void>;
    teamField?: keyof TItemProps & string;
    folderField?: keyof TItemProps & string;
};

export const deleteCatalogFolderTree = async <
    TFolder extends CatalogFolderEntity<TFolderProps>,
    TFolderProps extends CatalogFolderProps,
    TItem extends { _id: string },
    TItemProps extends object
>({
    teamId,
    folderId,
    folderRepository,
    itemRepository,
    deleteItem,
    teamField = 'team' as keyof TItemProps & string,
    folderField = 'folder' as keyof TItemProps & string
}: DeleteCatalogFolderTreeOptions<TFolder, TFolderProps, TItem, TItemProps>): Promise<void> => {
    const subfolders = await folderRepository.findAll({
        filter: {
            team: teamId,
            parent: folderId
        } as Partial<TFolderProps>
    });

    for (const subfolder of subfolders.data) {
        await deleteCatalogFolderTree({
            teamId,
            folderId: subfolder._id,
            folderRepository,
            itemRepository,
            deleteItem,
            teamField,
            folderField
        });
    }

    const items = await itemRepository.export({
        filter: {
            [teamField]: teamId,
            [folderField]: folderId
        } as Partial<TItemProps>
    });

    for (const item of items) {
        await deleteItem(item, teamId);
    }

    await folderRepository.deleteById(folderId);
};
