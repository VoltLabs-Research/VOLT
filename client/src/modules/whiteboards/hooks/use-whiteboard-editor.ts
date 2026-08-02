import service from '@/modules/whiteboards/api/service';
import { useUpdateWhiteboardMutation, whiteboardQuery } from '@/modules/whiteboards/hooks/queries';
import {
    cloneWhiteboardAppState,
    cloneWhiteboardElements,
    cloneWhiteboardFiles,
    extractWhiteboardFileIds,
    filterPersistableAppState,
    mergeWhiteboardAppState,
    mergeWhiteboardElements
} from '@/modules/whiteboards/utils/whiteboards';
import { createWhiteboardImageAsset } from '@/modules/whiteboards/utils/excalidraw-images';
import type { PreparedWhiteboardImageAsset } from '@/modules/whiteboards/utils/excalidraw-images';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sileo } from 'sileo';
import type { Whiteboard } from '@volt/contracts/modules/whiteboards/domain';
import type {
    WhiteboardAppState,
    WhiteboardElements,
    WhiteboardFiles,
    WhiteboardStoredScene
} from '@/modules/whiteboards/contracts/excalidraw';

interface UseWhiteboardEditorProps {
    whiteboardId: string;
};

const TITLE_SAVE_DEBOUNCE_MS = 1_000;

const useWhiteboardEditor = ({ whiteboardId }: UseWhiteboardEditorProps) => {
    const [whiteboard, setWhiteboard] = useState<Whiteboard | null>(null);
    const [initialState, setInitialState] = useState<WhiteboardStoredScene | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const { mutateAsync: updateWhiteboard } = useUpdateWhiteboardMutation();

    const titleRef = useRef<string | null>(null);
    const titleSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activeWhiteboardIdRef = useRef(whiteboardId);
    const currentElementsRef = useRef<WhiteboardElements>([]);
    const currentAppStateRef = useRef<WhiteboardAppState>({});
    const currentFilesRef = useRef<WhiteboardFiles>({});
    const loadingFilesRef = useRef(new Map<string, Promise<PreparedWhiteboardImageAsset>>());

    const updateSceneState = useCallback((nextState: WhiteboardStoredScene) => {
        const resolvedState = {
            elements: cloneWhiteboardElements(nextState.elements),
            appState: cloneWhiteboardAppState(nextState.appState),
            files: cloneWhiteboardFiles(nextState.files ?? {})
        } satisfies WhiteboardStoredScene;

        currentElementsRef.current = resolvedState.elements;
        currentAppStateRef.current = resolvedState.appState;
        currentFilesRef.current = resolvedState.files;
        setInitialState(resolvedState);
    }, []);

    const resetEditorState = useCallback(() => {
        if (titleSaveTimerRef.current) {
            clearTimeout(titleSaveTimerRef.current);
            titleSaveTimerRef.current = null;
        }

        titleRef.current = null;
        currentElementsRef.current = [];
        currentAppStateRef.current = {};
        currentFilesRef.current = {};
        loadingFilesRef.current.clear();
        setWhiteboard(null);
        setInitialState(null);
    }, []);

    const hydrateFiles = useCallback(async (elements: WhiteboardElements) => {
        const requestedFileIds = extractWhiteboardFileIds(elements);
        if (requestedFileIds.length === 0) {
            return currentFilesRef.current;
        }

        const loadedFiles = { ...currentFilesRef.current };

        await Promise.allSettled(
            requestedFileIds.map(async (assetId) => {
                if (loadedFiles[assetId]) {
                    return;
                }

                let filePromise = loadingFilesRef.current.get(assetId);
                if (!filePromise) {
                    filePromise = service.getWhiteboardAsset({
                        whiteboardId,
                        assetId
                    }).then((blob) => createWhiteboardImageAsset(assetId, blob));

                    loadingFilesRef.current.set(assetId, filePromise);
                }

                try {
                    loadedFiles[assetId] = await filePromise;
                } finally {
                    loadingFilesRef.current.delete(assetId);
                }
            })
        );

        if (activeWhiteboardIdRef.current !== whiteboardId) {
            return currentFilesRef.current;
        }

        currentFilesRef.current = loadedFiles;
        return loadedFiles;
    }, [whiteboardId]);

    useEffect(() => {
        activeWhiteboardIdRef.current = whiteboardId;
        resetEditorState();
    }, [resetEditorState, whiteboardId]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setIsLoading(true);
            try {
                const [meta, scene] = await Promise.all([
                    whiteboardQuery.fetch({ whiteboardId }),
                    service.getWhiteboardState({ whiteboardId })
                ]);

                if (cancelled) {
                    return;
                }

                const files = await hydrateFiles(scene.elements);

                if (cancelled) {
                    return;
                }

                setWhiteboard(meta);
                titleRef.current = meta.title ?? null;

                updateSceneState({
                    elements: mergeWhiteboardElements(scene.elements, currentElementsRef.current),
                    appState: mergeWhiteboardAppState(
                        filterPersistableAppState(scene.appState),
                        currentAppStateRef.current
                    ),
                    files: {
                        ...files,
                        ...currentFilesRef.current
                    }
                });
            } catch {
                if (!cancelled) {
                    resetEditorState();
                    sileo.error({ title: 'Failed to load whiteboard' });
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [hydrateFiles, resetEditorState, updateSceneState, whiteboardId]);

    const handleChange = useCallback((elements: WhiteboardElements, appState: WhiteboardAppState, files?: WhiteboardFiles) => {
        currentElementsRef.current = cloneWhiteboardElements(elements);
        currentAppStateRef.current = cloneWhiteboardAppState(appState);
        currentFilesRef.current = files
            ? cloneWhiteboardFiles(files)
            : currentFilesRef.current;

        const incomingTitle = typeof appState['name'] === 'string' ? appState['name'] : null;
        if (incomingTitle && incomingTitle !== titleRef.current) {
            titleRef.current = incomingTitle;

            if (titleSaveTimerRef.current) {
                clearTimeout(titleSaveTimerRef.current);
            }

            titleSaveTimerRef.current = setTimeout(() => {
                updateWhiteboard({
                    whiteboardId,
                    title: incomingTitle
                }).catch(() => {
                    sileo.error({ title: 'Failed to rename whiteboard' });
                });
            }, TITLE_SAVE_DEBOUNCE_MS);
        }
    }, [updateWhiteboard, whiteboardId]);

    const mergeRemoteState = useCallback(async (
        elements: WhiteboardElements,
        appState: WhiteboardAppState,
        elementOrder?: string[]
    ) => {
        const files = await hydrateFiles(elements);
        const nextState = {
            elements: mergeWhiteboardElements(currentElementsRef.current, elements, elementOrder),
            appState: mergeWhiteboardAppState(currentAppStateRef.current, appState),
            files
        } satisfies WhiteboardStoredScene;

        updateSceneState(nextState);
        return nextState;
    }, [hydrateFiles, updateSceneState]);

    useEffect(() => {
        return () => {
            if (titleSaveTimerRef.current) {
                clearTimeout(titleSaveTimerRef.current);
            }
        };
    }, []);

    const generateIdForFile = useCallback(async (file: File): Promise<string> => {
        try {
            const result = await service.uploadWhiteboardAsset({
                whiteboardId,
                file
            });
            return result.assetId;
        } catch {
            sileo.error({ title: 'Failed to upload asset' });
            return crypto.randomUUID();
        }
    }, [whiteboardId]);

    const prepareImageAsset = useCallback(async (file: File): Promise<PreparedWhiteboardImageAsset | null> => {
        try {
            const { assetId } = await service.uploadWhiteboardAsset({
                whiteboardId,
                file
            });
            const preparedAsset = await createWhiteboardImageAsset(assetId, file);

            currentFilesRef.current = {
                ...currentFilesRef.current,
                [assetId]: preparedAsset
            };

            return preparedAsset;
        } catch {
            sileo.error({ title: 'Failed to upload asset' });
            return null;
        }
    }, [whiteboardId]);

    return {
        whiteboard,
        initialState,
        isLoading,
        handleChange,
        mergeRemoteState,
        generateIdForFile,
        prepareImageAsset
    };
};

export default useWhiteboardEditor;
