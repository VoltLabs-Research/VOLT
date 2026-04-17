import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { applySearchParamUpdates } from '@/shared/presentation/hooks/use-search-params';

export const FOLDER_ID_SEARCH_PARAM = 'folderId';

interface UseFolderSearchParamReturn {
    currentFolderId: string | null;
    isInsideFolder: boolean;
    openFolder: (folderId: string) => void;
    goToRoot: () => void;
};

const useFolderSearchParam = (): UseFolderSearchParamReturn => {
    const [searchParams, setSearchParams] = useSearchParams();
    const rawFolderId = searchParams.get(FOLDER_ID_SEARCH_PARAM);
    const currentFolderId = rawFolderId === 'root' ? null : rawFolderId;

    const openFolder = useCallback((folderId: string) => {
        setSearchParams((prev) => applySearchParamUpdates(prev, {
            [FOLDER_ID_SEARCH_PARAM]: folderId,
            page: 1
        }));
    }, [setSearchParams]);

    const goToRoot = useCallback(() => {
        setSearchParams((prev) => applySearchParamUpdates(prev, {
            [FOLDER_ID_SEARCH_PARAM]: null,
            page: 1
        }));
    }, [setSearchParams]);

    return {
        currentFolderId,
        isInsideFolder: currentFolderId !== null,
        openFolder,
        goToRoot
    };
};

export default useFolderSearchParam;
