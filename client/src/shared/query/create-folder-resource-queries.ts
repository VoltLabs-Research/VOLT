import { createInvalidatingMutation, createQuery } from './create-paginated-query';
import queryClient from './query-client';
import type { QueryKey } from '@tanstack/react-query';

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
    buildFolderParams?: (folderId: string) => TGetParams;
    listingQueryKeys?: QueryKey[];
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
    const buildFolderParams = config.buildFolderParams ?? ((folderId: string) => ({ folderId }) as TGetParams);

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
    const listingQueryKeys = config.listingQueryKeys ?? [];

    return {
        foldersQueryKey,
        folderQueryKey,
        foldersQuery,
        folderQuery,
        invalidateFoldersQuery,
        invalidateFolderQuery,
        useCreateFolderMutation: createInvalidatingMutation<TFolder, TCreateParams>(
            config.service.createFolder,
            [foldersRootKey, ...listingQueryKeys]
        ),
        useUpdateFolderMutation: createInvalidatingMutation<TFolder, TUpdateParams>(
            config.service.updateFolder,
            (_data, variables) => [
                foldersRootKey,
                folderQueryKey(buildFolderParams(variables.folderId)),
                ...listingQueryKeys
            ]
        ),
        useDeleteFolderMutation: createInvalidatingMutation<void, TDeleteParams>(
            config.service.deleteFolder,
            (_data, variables) => [
                foldersRootKey,
                folderQueryKey(buildFolderParams(variables.folderId)),
                ...listingQueryKeys
            ]
        )
    };
};
