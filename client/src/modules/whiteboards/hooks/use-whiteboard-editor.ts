import service from '@/modules/whiteboards/api/service';
import { useUpdateWhiteboardMutation, whiteboardQuery } from '@/modules/whiteboards/hooks/queries';
import {
    extractWhiteboardFileIds,
    filterPersistableAppState,
    mergeWhiteboardAppState,
    mergeWhiteboardElements
} from '@/modules/whiteboards/utilities/whiteboards';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sileo } from 'sileo';
import type { Whiteboard } from '@/modules/whiteboards/api/entities/whiteboard';

type ExcalidrawElements = Record<string, unknown>[];
type AppState = Record<string, unknown>;
type ExcalidrawFiles = Record<string, unknown>;

interface WhiteboardState {
    elements: ExcalidrawElements;
    appState: AppState;
    files?: ExcalidrawFiles;
    revision?: number;
};

interface UseWhiteboardEditorProps {
    whiteboardId: string;
};

/** Title save debounce interval in ms */
const TITLE_SAVE_DEBOUNCE_MS = 1_000;

const blobToDataURL = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

const useWhiteboardEditor = ({ whiteboardId }: UseWhiteboardEditorProps) => {
    const [whiteboard, setWhiteboard] = useState<Whiteboard | null>(null);
    const [initialState, setInitialState] = useState<WhiteboardState | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const { mutateAsync: updateWhiteboard } = useUpdateWhiteboardMutation();

    const titleRef = useRef<string | null>(null);
    const titleSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentElementsRef = useRef<ExcalidrawElements>([]);
    const currentAppStateRef = useRef<AppState>({});
    const currentFilesRef = useRef<ExcalidrawFiles>({});
    const loadingFileIdsRef = useRef(new Set<string>());

    const updateSceneState = useCallback((nextState: WhiteboardState) => {
        currentElementsRef.current = nextState.elements;
        currentAppStateRef.current = nextState.appState;
        currentFilesRef.current = nextState.files ?? {};
        setInitialState(nextState);
    }, []);

    const hydrateFiles = useCallback(async (elements: ExcalidrawElements) => {
        const requestedFileIds = extractWhiteboardFileIds(elements);
        if (requestedFileIds.length === 0) {
            return currentFilesRef.current;
        }

        const loadedFiles = { ...currentFilesRef.current };

        await Promise.allSettled(
            requestedFileIds.map(async (assetId) => {
                if (loadedFiles[assetId] || loadingFileIdsRef.current.has(assetId)) {
                    return;
                }

                loadingFileIdsRef.current.add(assetId);

                try {
                    const blob = await service.getWhiteboardAsset({ whiteboardId, assetId });
                    const dataURL = await blobToDataURL(blob);

                    loadedFiles[assetId] = {
                        id: assetId,
                        mimeType: blob.type || 'image/png',
                        dataURL,
                        created: Date.now()
                    };
                } finally {
                    loadingFileIdsRef.current.delete(assetId);
                }
            })
        );

        currentFilesRef.current = loadedFiles;
        return loadedFiles;
    }, [whiteboardId]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setIsLoading(true);
            try {
                const [meta, state] = await Promise.all([
                    whiteboardQuery.fetch({ whiteboardId }),
                    service.getWhiteboardState({ whiteboardId })
                ]);

                if (cancelled) {
                    return;
                }

                const parsed = (state as WhiteboardState) ?? { elements: [], appState: {}, revision: 0 };
                const files = await hydrateFiles(parsed.elements ?? []);

                if (cancelled) {
                    return;
                }

                setWhiteboard(meta);
                titleRef.current = meta.title ?? null;
                const loadedState = {
                    elements: parsed.elements ?? [],
                    appState: filterPersistableAppState(parsed.appState ?? {}),
                    files,
                    revision: typeof parsed.revision === 'number' ? parsed.revision : 0
                } satisfies WhiteboardState;

                updateSceneState({
                    elements: mergeWhiteboardElements(loadedState.elements, currentElementsRef.current),
                    appState: mergeWhiteboardAppState(loadedState.appState, currentAppStateRef.current),
                    files: {
                        ...loadedState.files,
                        ...currentFilesRef.current
                    },
                    revision: loadedState.revision
                });
            } catch {
                if (!cancelled) {
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
    }, [hydrateFiles, updateSceneState, whiteboardId]);

    const handleChange = useCallback((elements: ExcalidrawElements, appState: AppState, files?: ExcalidrawFiles) => {
        currentElementsRef.current = elements;
        currentAppStateRef.current = appState;
        currentFilesRef.current = files ?? currentFilesRef.current;

        const incomingTitle = typeof appState['name'] === 'string' ? appState['name'] : null;
        if (incomingTitle && incomingTitle !== titleRef.current) {
            titleRef.current = incomingTitle;

            if (titleSaveTimerRef.current) {
                clearTimeout(titleSaveTimerRef.current);
            }

            titleSaveTimerRef.current = setTimeout(() => {
                updateWhiteboard({ whiteboardId, title: incomingTitle }).catch(() => {
                    sileo.error({ title: 'Failed to rename whiteboard' });
                });
            }, TITLE_SAVE_DEBOUNCE_MS);
        }
    }, [updateWhiteboard, whiteboardId]);

    const mergeRemoteState = useCallback(async (elements: ExcalidrawElements, appState: AppState, revision: number) => {
        const files = await hydrateFiles(elements);
        const nextState = {
            elements: mergeWhiteboardElements(currentElementsRef.current, elements),
            appState: mergeWhiteboardAppState(currentAppStateRef.current, appState),
            files,
            revision
        } satisfies WhiteboardState;

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
            const result = await service.uploadWhiteboardAsset({ whiteboardId, file });
            return result.assetId;
        } catch {
            sileo.error({ title: 'Failed to upload asset' });
            return crypto.randomUUID();
        }
    }, [whiteboardId]);

    return {
        whiteboard,
        initialState,
        isLoading,
        handleChange,
        mergeRemoteState,
        generateIdForFile
    };
};

export default useWhiteboardEditor;
