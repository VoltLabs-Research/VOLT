import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Dispatch, SetStateAction } from 'react';

export interface RemoteExplorerFetchState<TEntry> {
    entries: TEntry[];
    cwd?: string;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<unknown>;
    isRefreshing?: boolean;
};

export interface RemoteExplorerState<TEntry> extends RemoteExplorerFetchState<TEntry> {
    path: string;
    cwd: string;
    isAtRoot: boolean;
    selectedPath: string | null;
    setSelectedPath: Dispatch<SetStateAction<string | null>>;
    clearSelection: () => void;
    navigateTo: (path: string) => void;
    navigateToChild: (name: string) => void;
    joinPath: (name: string, basePath?: string) => string;
    goUp: () => void;
};

interface UseRemoteExplorerConfig {
    initialPath: string;
    normalizeRootPath: (path: string) => string;
    pathParam?: string;
    resetParamKeys?: string[];
};

const trimTrailingSlash = (path: string) => {
    if (path === '/' || path === '.') {
        return path;
    }

    return path.replace(/\/+$/, '');
};

export const useRemoteExplorer = ({
    initialPath,
    normalizeRootPath,
    pathParam = 'path',
    resetParamKeys = []
}: UseRemoteExplorerConfig) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedPath, setSelectedPath] = useState<string | null>(null);

    const normalizePath = (path: string) => {
        const normalizedPath = normalizeRootPath(path);

        if (!normalizedPath) {
            return trimTrailingSlash(normalizeRootPath(initialPath));
        }

        return trimTrailingSlash(normalizedPath);
    };

    const rootPath = normalizePath(initialPath);
    const path = normalizePath(searchParams.get(pathParam) || rootPath);

    const clearSelection = () => {
        setSelectedPath(null);
    };

    const updatePathSearchParam = (nextPath: string) => {
        const normalizedNextPath = normalizePath(nextPath);

        setSearchParams((previousParams) => {
            const nextParams = new URLSearchParams(previousParams);

            if (normalizedNextPath === rootPath) {
                nextParams.delete(pathParam);
            } else {
                nextParams.set(pathParam, normalizedNextPath);
            }

            resetParamKeys.forEach((key) => nextParams.delete(key));

            return nextParams;
        });
    };

    const navigateTo = (nextPath: string) => {
        clearSelection();
        updatePathSearchParam(nextPath);
    };

    const isAtRootPath = (currentPath: string) => {
        return normalizePath(currentPath) === rootPath;
    };

    const joinPath = (name: string, basePath = path) => {
        const normalizedBasePath = normalizePath(basePath);

        if (normalizedBasePath === '/') {
            return normalizePath(`/${name}`);
        }

        if (normalizedBasePath === '.') {
            return normalizePath(name);
        }

        return normalizePath(`${normalizedBasePath}/${name}`);
    };

    const getParentPath = (currentPath: string) => {
        const normalizedCurrentPath = normalizePath(currentPath);

        if (isAtRootPath(normalizedCurrentPath)) {
            return rootPath;
        }

        const segments = normalizedCurrentPath.split('/').filter(Boolean);
        segments.pop();

        if (normalizedCurrentPath.startsWith('/')) {
            return segments.length > 0 ? `/${segments.join('/')}` : rootPath;
        }

        return segments.join('/') || rootPath;
    };

    const goUpFrom = (currentPath: string) => {
        const parentPath = getParentPath(currentPath);

        if (parentPath === normalizePath(currentPath)) {
            return;
        }

        navigateTo(parentPath);
    };

    const navigateToChild = (name: string) => {
        navigateTo(joinPath(name));
    };

    const goUp = () => {
        goUpFrom(path);
    };

    const bindState = <TEntry,>(fetchState: RemoteExplorerFetchState<TEntry>): RemoteExplorerState<TEntry> => {
        const cwd = normalizePath(fetchState.cwd || path);

        return {
            ...fetchState,
            path,
            cwd,
            isAtRoot: isAtRootPath(cwd),
            selectedPath,
            setSelectedPath,
            clearSelection,
            navigateTo,
            navigateToChild: (name: string) => navigateTo(joinPath(name, cwd)),
            joinPath: (name: string, basePath = cwd) => joinPath(name, basePath),
            goUp: () => goUpFrom(cwd)
        };
    };

    return {
        path,
        rootPath,
        selectedPath,
        setSelectedPath,
        clearSelection,
        navigateTo,
        navigateToChild,
        joinPath,
        goUp,
        bindState
    };
};
