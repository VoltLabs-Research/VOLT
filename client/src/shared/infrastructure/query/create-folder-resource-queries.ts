import { createMutation, createQuery } from './create-paginated-query';
import queryClient from './query-client';

interface FolderResourceService<
    TFolder,
    TFoldersResult,
    TListParams,
    TGetParams,
    TCreateParams,
    TUpdateParams,
    TDeleteParams
> {
    listFolders: (params: TListParams) => Promise<TFoldersResult>;
    getFolder: (params: TGetParams) => Promise<TFolder>;
    createFolder: (params: TCreateParams) => Promise<TFolder>;
    updateFolder: (params: TUpdateParams) => Promise<TFolder>;
    deleteFolder: (params: TDeleteParams) => Promise<void>;
}

interface CreateFolderResourceQueriesConfig<
    TFolder,
    TFoldersResult,
    TListParams extends object,
    TGetParams extends object,
    TCreateParams,
    TUpdateParams,
    TDeleteParams
> {
    baseKey: string;
    service: FolderResourceService<TFolder, TFoldersResult, TListParams, TGetParams, TCreateParams, TUpdateParams, TDeleteParams>;
    buildFolderParams: (folderId: string) => TGetParams;
    afterCreate?: () => void;
    afterUpdate?: (variables: TUpdateParams) => void;
    afterDelete?: (variables: TDeleteParams) => void;
}

export const createFolderResourceQueries = <
    TFolder,
    TFoldersResult,
    TListParams extends object,
    TGetParams extends object,
    TCreateParams,
    TUpdateParams extends { folderId: string },
    TDeleteParams extends { folderId: string }
>(
    config: CreateFolderResourceQueriesConfig<TFolder, TFoldersResult, TListParams, TGetParams, TCreateParams, TUpdateParams, TDeleteParams>
) => {
    const foldersRootKey = [config.baseKey, 'folders'] as const;
    const folderRootKey = [config.baseKey, 'folder'] as const;
    const foldersQueryKey = (params: TListParams) => [...foldersRootKey, params] as const;
    const folderQueryKey = (params: TGetParams) => [...folderRootKey, params] as const;

    const foldersQuery = createQuery<TListParams, TFoldersResult>(
        foldersQueryKey,
        config.service.listFolders
    );
    const folderQuery = createQuery<TGetParams, TFolder>(
        folderQueryKey,
        config.service.getFolder
    );

    const invalidateFoldersQuery = () => queryClient.invalidateQueries({ queryKey: foldersRootKey });
    const invalidateFolderQuery = (params: TGetParams) => queryClient.invalidateQueries({ queryKey: folderQueryKey(params) });

    return {
        foldersQueryKey,
        folderQueryKey,
        foldersQuery,
        folderQuery,
        invalidateFoldersQuery,
        invalidateFolderQuery,
        useCreateFolderMutation: createMutation<TFolder, TCreateParams>(
            config.service.createFolder,
            () => {
                void invalidateFoldersQuery();
                config.afterCreate?.();
            }
        ),
        useUpdateFolderMutation: createMutation<TFolder, TUpdateParams>(
            config.service.updateFolder,
            (_data, variables) => {
                void invalidateFoldersQuery();
                void invalidateFolderQuery(config.buildFolderParams(variables.folderId));
                config.afterUpdate?.(variables);
            }
        ),
        useDeleteFolderMutation: createMutation<void, TDeleteParams>(
            config.service.deleteFolder,
            (_data, variables) => {
                void invalidateFoldersQuery();
                void invalidateFolderQuery(config.buildFolderParams(variables.folderId));
                config.afterDelete?.(variables);
            }
        )
    };
};
