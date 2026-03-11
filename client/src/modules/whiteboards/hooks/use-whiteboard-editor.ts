import service from '@/modules/whiteboards/api/service';
import { whiteboardQuery } from '@/modules/whiteboards/hooks/queries';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sileo } from 'sileo';
import type { Whiteboard } from '@/modules/whiteboards/api/entities/whiteboard';

type ExcalidrawElements = Record<string, unknown>[];
type AppState = Record<string, unknown>;

interface SerializedFileData {
    id: string;
    mimeType: string;
    dataURL: string;
    created: number;
};

interface WhiteboardState {
    elements: ExcalidrawElements;
    appState: AppState;
    files?: Record<string, SerializedFileData>;
};

interface UseWhiteboardEditorProps {
    whiteboardId: string;
};

/** Auto-save debounce interval in ms */
const SAVE_DEBOUNCE_MS = 500;
/** Periodic full-save checkpoint interval in ms */
const FULL_SAVE_INTERVAL_MS = 30_000;

const blobToDataURL = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });

const extractImageFileIds = (elements: ExcalidrawElements): string[] => {
    const ids: string[] = [];
    for (const el of elements) {
        if (el['type'] === 'image' && typeof el['fileId'] === 'string' && el['fileId']) {
            ids.push(el['fileId'] as string);
        }
    }
    return ids;
};

const useWhiteboardEditor = ({ whiteboardId }: UseWhiteboardEditorProps) => {
    const [whiteboard, setWhiteboard] = useState<Whiteboard | null>(null);
    const [initialState, setInitialState] = useState<WhiteboardState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const pendingStateRef = useRef<WhiteboardState | null>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fullSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

                const parsed = (state as WhiteboardState) ?? { elements: [], appState: {} };
                const fileIds = extractImageFileIds(parsed.elements ?? []);
                const files: Record<string, SerializedFileData> = {};

                await Promise.allSettled(
                    fileIds.map(async (assetId) => {
                        const blob = await service.getWhiteboardAsset({ whiteboardId, assetId });
                        const dataURL = await blobToDataURL(blob);
                        files[assetId] = {
                            id: assetId,
                            mimeType: blob.type || 'image/png',
                            dataURL,
                            created: Date.now()
                        };
                    })
                );

                if (cancelled) {
                    return;
                }

                setWhiteboard(meta);
                setInitialState({ ...parsed, files });
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
    }, [whiteboardId]);

    const saveState = useCallback(async (state: WhiteboardState) => {
        setIsSaving(true);
        try {
            await service.saveWhiteboardState({ whiteboardId, state });
        } catch {
            sileo.error({ title: 'Auto-save failed' });
        } finally {
            setIsSaving(false);
        }
    }, [whiteboardId]);

    const handleChange = useCallback((elements: ExcalidrawElements, appState: AppState) => {
        pendingStateRef.current = { elements, appState };

        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
        }

        saveTimerRef.current = setTimeout(() => {
            const state = pendingStateRef.current;
            if (state) {
                saveState(state);
            }
        }, SAVE_DEBOUNCE_MS);
    }, [saveState]);

    useEffect(() => {
        fullSaveTimerRef.current = setInterval(() => {
            const state = pendingStateRef.current;
            if (state) {
                saveState(state);
            }
        }, FULL_SAVE_INTERVAL_MS);

        return () => {
            if (saveTimerRef.current) {
                clearTimeout(saveTimerRef.current);
            }

            if (fullSaveTimerRef.current) {
                clearInterval(fullSaveTimerRef.current);
            }
        };
    }, [saveState]);

    /**
     * Uploads a file to the server and returns its server-assigned ID.
     * This is the Excalidraw `generateIdForFile` integration point - the
     * returned ID becomes the element's `fileId` and is later used to
     * fetch the asset via the authenticated API route.
     */
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
        isSaving,
        handleChange,
        generateIdForFile
    };
};

export default useWhiteboardEditor;
