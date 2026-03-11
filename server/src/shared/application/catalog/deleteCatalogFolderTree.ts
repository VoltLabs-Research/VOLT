import type { CatalogFolderEntity, CatalogFolderProps } from '@shared/domain/catalog/CatalogFolder';
import type { ICatalogFolderRepository } from '@shared/domain/catalog/ICatalogFolderRepository';
import type { IBaseRepository } from '@shared/domain/port/IBaseRepository';

interface DeleteCatalogFolderTreeOptions<
    TFolder extends CatalogFolderEntity<TFolderProps>,
    TFolderProps extends CatalogFolderProps,
    TItemProps extends object
> {
    teamId: string;
    folderId: string;
    folderRepository: ICatalogFolderRepository<TFolder, TFolderProps>;
    itemRepository: IBaseRepository<unknown, TItemProps>;
    teamField?: keyof TItemProps & string;
    folderField?: keyof TItemProps & string;
};

export const deleteCatalogFolderTree = async <
    TFolder extends CatalogFolderEntity<TFolderProps>,
    TFolderProps extends CatalogFolderProps,
    TItemProps extends object
>({
    teamId,
    folderId,
    folderRepository,
    itemRepository,
    teamField = 'team' as keyof TItemProps & string,
    folderField = 'folder' as keyof TItemProps & string
}: DeleteCatalogFolderTreeOptions<TFolder, TFolderProps, TItemProps>): Promise<void> => {
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
            teamField,
            folderField
        });
    }

    await itemRepository.updateMany(
        {
            [teamField]: teamId,
            [folderField]: folderId
        } as Partial<TItemProps>,
        {
            [folderField]: null
        } as Partial<TItemProps>
    );

    await folderRepository.deleteById(folderId);
};
