import useSearchParamsState from '@/shared/presentation/hooks/use-search-params';
import { useCallback } from 'react';

export const FOLDER_ID_SEARCH_PARAM = 'folderId';

interface UseFolderSearchParamReturn {
    currentFolderId: string | null;
    isInsideFolder: boolean;
    openFolder: (folderId: string) => void;
    goToRoot: () => void;
};

const useFolderSearchParam = (): UseFolderSearchParamReturn => {
    const { searchParams, updateSearchParams } = useSearchParamsState();
    const currentFolderId = searchParams.get(FOLDER_ID_SEARCH_PARAM);

    const openFolder = useCallback((folderId: string) => {
        updateSearchParams({
            [FOLDER_ID_SEARCH_PARAM]: folderId,
            page: 1
        });
    }, [updateSearchParams]);

    const goToRoot = useCallback(() => {
        updateSearchParams({
            [FOLDER_ID_SEARCH_PARAM]: null,
            page: 1
        });
    }, [updateSearchParams]);

    return {
        currentFolderId,
        isInsideFolder: currentFolderId !== null,
        openFolder,
        goToRoot
    };
};

export default useFolderSearchParam;
