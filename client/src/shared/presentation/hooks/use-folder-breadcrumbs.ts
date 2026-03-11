import { getApiErrorMessage, isApiError, markApiErrorHandled } from '@/shared/errors/notify-api-error';
import { useEffect, useMemo, useState } from 'react';
import { sileo } from 'sileo';

export interface FolderBreadcrumbEntity {
    _id: string;
    title: string;
    parent: string | null;
};

export interface FolderBreadcrumbItem {
    id: string | null;
    title: string;
};

interface UseFolderBreadcrumbsOptions<TFolder extends FolderBreadcrumbEntity> {
    currentFolderId: string | null;
    getFolder: (folderId: string) => Promise<TFolder>;
    onInvalidFolder: () => void;
    refreshKey?: number;
    rootLabel?: string;
    invalidFolderMessage?: string;
};

interface UseFolderBreadcrumbsReturn<TFolder extends FolderBreadcrumbEntity> {
    breadcrumbs: FolderBreadcrumbItem[];
    currentFolder: TFolder | null;
    isLoading: boolean;
};

const buildRootBreadcrumb = (rootLabel: string): FolderBreadcrumbItem[] => {
    return [{ id: null, title: rootLabel }];
};

const isInvalidFolderError = (error: unknown): boolean => {
    return isApiError(error) && (error.status === 400 || error.status === 404);
};

const useFolderBreadcrumbs = <TFolder extends FolderBreadcrumbEntity>({
    currentFolderId,
    getFolder,
    onInvalidFolder,
    refreshKey = 0,
    rootLabel = 'Root',
    invalidFolderMessage = 'This folder no longer exists. Showing Root instead.'
}: UseFolderBreadcrumbsOptions<TFolder>): UseFolderBreadcrumbsReturn<TFolder> => {
    const rootBreadcrumb = useMemo(() => buildRootBreadcrumb(rootLabel), [rootLabel]);
    const [breadcrumbs, setBreadcrumbs] = useState<FolderBreadcrumbItem[]>(rootBreadcrumb);
    const [currentFolder, setCurrentFolder] = useState<TFolder | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        let isCancelled = false;

        const loadBreadcrumbs = async () => {
            if (!currentFolderId) {
                setBreadcrumbs(rootBreadcrumb);
                setCurrentFolder(null);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);

            try {
                const visitedFolderIds = new Set<string>();
                const folderChain: TFolder[] = [];
                let nextFolderId: string | null = currentFolderId;

                while (nextFolderId) {
                    if (visitedFolderIds.has(nextFolderId)) {
                        break;
                    }

                    visitedFolderIds.add(nextFolderId);
                    const folder = await getFolder(nextFolderId);
                    folderChain.unshift(folder);
                    nextFolderId = folder.parent;
                }

                if (isCancelled) {
                    return;
                }

                setBreadcrumbs([
                    ...rootBreadcrumb,
                    ...folderChain.map((folder) => ({
                        id: folder._id,
                        title: folder.title
                    }))
                ]);
                setCurrentFolder(folderChain[folderChain.length - 1] ?? null);
            } catch (error) {
                if (isCancelled) {
                    return;
                }

                if (isInvalidFolderError(error)) {
                    markApiErrorHandled(error);
                    setBreadcrumbs(rootBreadcrumb);
                    setCurrentFolder(null);
                    sileo.info({ title: invalidFolderMessage });
                    onInvalidFolder();
                    return;
                }

                sileo.error({
                    title: getApiErrorMessage(error, 'Failed to load folder path')
                });
                setBreadcrumbs(rootBreadcrumb);
                setCurrentFolder(null);
            } finally {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            }
        };

        loadBreadcrumbs();

        return () => {
            isCancelled = true;
        };
    }, [currentFolderId, getFolder, invalidFolderMessage, onInvalidFolder, refreshKey, rootBreadcrumb]);

    return {
        breadcrumbs,
        currentFolder,
        isLoading
    };
};

export default useFolderBreadcrumbs;
