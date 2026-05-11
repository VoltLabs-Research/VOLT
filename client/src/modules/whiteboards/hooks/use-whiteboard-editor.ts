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
} from '@/modules/whiteboards/utilities/whiteboards';
import type { PreparedWhiteboardImageAsset } from '@/modules/whiteboards/utilities/excalidraw-images';
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

interface HydratedWhiteboardFile {
    id: string;
    mimeType: string;
    dataURL: string;
    created: number;
};

interface UseWhiteboardEditorProps {
    whiteboardId: string;
};

/** Title save debounce interval in ms */
const TITLE_SAVE_DEBOUNCE_MS = 1_000;
const EXCALIDRAW_IMAGE_MIME_TYPES = new Set<PreparedWhiteboardImageAsset['mimeType']>([
    'image/svg+xml',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/x-icon',
    'image/avif',
    'image/jfif',
    'application/octet-stream'
]);

const blobToDataURL = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

const resolveExcalidrawImageMimeType = (mimeType?: string): PreparedWhiteboardImageAsset['mimeType'] => {
    if (mimeType && EXCALIDRAW_IMAGE_MIME_TYPES.has(mimeType as PreparedWhiteboardImageAsset['mimeType'])) {
        return mimeType as PreparedWhiteboardImageAsset['mimeType'];
    }

    return 'image/png';
};

const useWhiteboardEditor = ({ whiteboardId }: UseWhiteboardEditorProps) => {
    const [whiteboard, setWhiteboard] = useState<Whiteboard | null>(null);
    const [initialState, setInitialState] = useState<WhiteboardState | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const { mutateAsync: updateWhiteboard } = useUpdateWhiteboardMutation();

    const titleRef = useRef<string | null>(null);
    const titleSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activeWhiteboardIdRef = useRef(whiteboardId);
    const currentElementsRef = useRef<ExcalidrawElements>([]);
    const currentAppStateRef = useRef<AppState>({});
    const currentFilesRef = useRef<ExcalidrawFiles>({});
    const loadingFilesRef = useRef(new Map<string, Promise<HydratedWhiteboardFile>>());

    const updateSceneState = useCallback((nextState: WhiteboardState) => {
        const resolvedState = {
            ...nextState,
            elements: cloneWhiteboardElements(nextState.elements),
            appState: cloneWhiteboardAppState(nextState.appState),
            files: cloneWhiteboardFiles(nextState.files ?? {})
        } satisfies WhiteboardState;

        currentElementsRef.current = resolvedState.elements;
        currentAppStateRef.current = resolvedState.appState;
        currentFilesRef.current = resolvedState.files ?? {};
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

    const hydrateFiles = useCallback(async (elements: ExcalidrawElements) => {
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
                    filePromise = (async () => {
                        const blob = await service.getWhiteboardAsset({ whiteboardId, assetId });
                        const dataURL = await blobToDataURL(blob);

                        return {
                            id: assetId,
                            mimeType: blob.type || 'image/png',
                            dataURL,
                            created: Date.now()
                        } satisfies HydratedWhiteboardFile;
                    })();

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

    const handleChange = useCallback((elements: ExcalidrawElements, appState: AppState, files?: ExcalidrawFiles) => {
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
                updateWhiteboard({ whiteboardId, title: incomingTitle }).catch(() => {
                    sileo.error({ title: 'Failed to rename whiteboard' });
                });
            }, TITLE_SAVE_DEBOUNCE_MS);
        }
    }, [updateWhiteboard, whiteboardId]);

    const mergeRemoteState = useCallback(async (
        elements: ExcalidrawElements,
        appState: AppState,
        revision: number,
        elementOrder?: string[]
    ) => {
        const files = await hydrateFiles(elements);
        const nextState = {
            elements: mergeWhiteboardElements(currentElementsRef.current, elements, elementOrder),
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

    const prepareImageAsset = useCallback(async (file: File): Promise<PreparedWhiteboardImageAsset | null> => {
        try {
            const result = await service.uploadWhiteboardAsset({ whiteboardId, file });
            const created = Date.now();
            const preparedAsset = {
                id: result.assetId as PreparedWhiteboardImageAsset['id'],
                mimeType: resolveExcalidrawImageMimeType(file.type),
                dataURL: await blobToDataURL(file) as PreparedWhiteboardImageAsset['dataURL'],
                created,
                lastRetrieved: created
            } satisfies PreparedWhiteboardImageAsset;

            currentFilesRef.current = {
                ...currentFilesRef.current,
                [result.assetId]: preparedAsset
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
