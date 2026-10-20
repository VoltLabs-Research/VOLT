import useWhiteboardEditor from './use-whiteboard-editor';
import useWhiteboardSync from './use-whiteboard-sync';
import { applyWhiteboardDrawRequest } from '@/modules/whiteboards/utils/whiteboard-draw';
import { rematerializeWhiteboardImageFiles } from '@/modules/whiteboards/utils/excalidraw-images';
import { useWhiteboardEditorHandleStore } from '@/modules/whiteboards/store/use-whiteboard-editor-handle-store';
import type { WhiteboardDrawRequest } from '@/modules/whiteboards/store/use-whiteboard-editor-handle-store';
import {
    filterPersistableAppState,
    normalizeWhiteboardRuntimeAppState
} from '@/modules/whiteboards/utils/whiteboards';
import { useCallback, useEffect, useRef } from 'react';
import { sileo } from 'sileo';
import type {
    ExcalidrawAPI,
    ExcalidrawChangeAppState,
    ExcalidrawChangeElements,
    ExcalidrawChangeFiles,
    ExcalidrawChangeHandler,
    ExcalidrawProps,
    WhiteboardAppState,
    WhiteboardElements,
    WhiteboardFiles,
    WhiteboardStoredScene
} from '@/modules/whiteboards/contracts/excalidraw';

interface UseWhiteboardCanvasBridgeProps {
    whiteboardId: string;
};

const createSceneSignature = (elements: WhiteboardElements, appState: WhiteboardAppState): string => {
    const persistable = filterPersistableAppState(appState);
    let versionSum = elements.length;
    let nonceSum = persistable.gridSize === undefined ? 0 : Number(persistable.gridSize) || 0;

    for (const element of elements) {
        versionSum = (versionSum + element.version + element.updated) | 0;
        nonceSum = (nonceSum + element.versionNonce) | 0;
    }

    return `${elements.length}:${versionSum}:${nonceSum}:${String(persistable.viewBackgroundColor ?? '')}`;
};

const syncSceneFiles = (api: ExcalidrawAPI, files?: WhiteboardFiles) => {
    const nextFiles = Object.values(files ?? {});
    if (nextFiles.length === 0) {
        return;
    }

    api.addFiles(nextFiles as Parameters<ExcalidrawAPI['addFiles']>[0]);
};

const pushSceneToCanvas = (api: ExcalidrawAPI, scene: WhiteboardStoredScene) => {
    syncSceneFiles(api, scene.files);
    api.updateScene({
        elements: scene.elements as unknown as ExcalidrawChangeElements,
        appState: normalizeWhiteboardRuntimeAppState(scene.appState) as unknown as ExcalidrawChangeAppState
    });
};

const useWhiteboardCanvasBridge = ({ whiteboardId }: UseWhiteboardCanvasBridgeProps) => {
    const excalidrawApiRef = useRef<ExcalidrawAPI | null>(null);
    const pendingSceneRef = useRef<WhiteboardStoredScene | null>(null);
    const ignoredSceneSignatureRef = useRef<string | null>(null);

    const {
        whiteboard,
        initialState,
        isLoading,
        handleChange,
        mergeRemoteState,
        generateIdForFile: uploadFileId,
        prepareImageAsset,
        ownedFileIdsRef
    } = useWhiteboardEditor({ whiteboardId });
    const rematerializingRef = useRef(false);

    const handleRemoteState = useCallback(
        async (elements: WhiteboardElements, appState: WhiteboardAppState, elementOrder?: string[]) => {
            const scene = await mergeRemoteState(elements, appState, elementOrder);
            pendingSceneRef.current = scene;

            if (!excalidrawApiRef.current) {
                return;
            }

            ignoredSceneSignatureRef.current = createSceneSignature(scene.elements, scene.appState);
            pushSceneToCanvas(excalidrawApiRef.current, scene);
        },
        [mergeRemoteState]
    );

    const { sendDelta } = useWhiteboardSync({
        whiteboardId,
        enabled: Boolean(whiteboardId),
        onRemoteState: handleRemoteState
    });

    const handleExcalidrawChange = useCallback<ExcalidrawChangeHandler>(
        (elements: ExcalidrawChangeElements, appState: ExcalidrawChangeAppState, files?: ExcalidrawChangeFiles) => {
            const mutableElements = elements as unknown as WhiteboardElements;
            const mutableAppState = appState as unknown as WhiteboardAppState;
            const currentSceneSignature = createSceneSignature(mutableElements, mutableAppState);

            if (ignoredSceneSignatureRef.current === currentSceneSignature) {
                ignoredSceneSignatureRef.current = null;
                return;
            }

            handleChange(mutableElements, mutableAppState, (files ?? undefined) as WhiteboardFiles | undefined);

            const hasForeignImage = Boolean(files) && mutableElements.some((element) => (
                Boolean(element.fileId) && !ownedFileIdsRef.current.has(element.fileId as string)
            ));

            if (!hasForeignImage) {
                sendDelta(mutableElements, mutableAppState);
                return;
            }

            if (rematerializingRef.current) {
                return;
            }

            rematerializingRef.current = true;
            void rematerializeWhiteboardImageFiles({
                elements: mutableElements,
                files: files as WhiteboardFiles,
                ownedFileIds: ownedFileIdsRef.current,
                prepareFile: prepareImageAsset
            }).then((result) => {
                const api = excalidrawApiRef.current;
                if (!api) {
                    return;
                }

                if (!result.changed) {
                    sendDelta(mutableElements, mutableAppState);
                    return;
                }

                if (result.assets.length > 0) {
                    api.addFiles(result.assets);
                }

                ignoredSceneSignatureRef.current = createSceneSignature(
                    result.elements as WhiteboardElements,
                    mutableAppState
                );
                api.updateScene({
                    elements: result.elements as unknown as ExcalidrawChangeElements,
                    appState
                });
                handleChange(result.elements as WhiteboardElements, mutableAppState, result.files);
                sendDelta(result.elements as WhiteboardElements, mutableAppState);
            }).finally(() => {
                rematerializingRef.current = false;
            });
        },
        [handleChange, ownedFileIdsRef, prepareImageAsset, sendDelta]
    );

    const generateIdForFile = useCallback(async (file: File): Promise<string> => {
        try {
            return await uploadFileId(file);
        } catch {
            sileo.error({ title: 'Failed to upload asset' });
            throw new Error('Failed to upload whiteboard asset');
        }
    }, [uploadFileId]);

    const handleExcalidrawAPI = useCallback((api: ExcalidrawAPI) => {
        excalidrawApiRef.current = api;
        const pendingScene = pendingSceneRef.current;
        if (!pendingScene) {
            return;
        }

        ignoredSceneSignatureRef.current = createSceneSignature(pendingScene.elements, pendingScene.appState);
        pushSceneToCanvas(api, pendingScene);
    }, []);

    const registerEditorHandle = useWhiteboardEditorHandleStore((state) => state.register);
    const unregisterEditorHandle = useWhiteboardEditorHandleStore((state) => state.unregister);

    useEffect(() => {
        if (!whiteboardId) {
            return;
        }

        registerEditorHandle({
            whiteboardId,
            isReady: () => Boolean(excalidrawApiRef.current),
            draw: (request: WhiteboardDrawRequest) => {
                const api = excalidrawApiRef.current;
                if (!api) {
                    return { drawn: 0 };
                }

                return applyWhiteboardDrawRequest(api, request);
            }
        });

        return () => {
            unregisterEditorHandle();
        };
    }, [whiteboardId, registerEditorHandle, unregisterEditorHandle]);

    const excalidrawInitialData = {
        elements: initialState?.elements ?? [],
        appState: normalizeWhiteboardRuntimeAppState(initialState?.appState ?? {}),
        files: initialState?.files
    } as unknown as ExcalidrawProps['initialData'];

    return {
        whiteboard,
        isLoading,
        excalidrawApiRef,
        excalidrawInitialData,
        generateIdForFile,
        prepareImageAsset,
        handleExcalidrawChange,
        handleExcalidrawAPI
    };
};

export default useWhiteboardCanvasBridge;
