import useWhiteboardEditor from '@/modules/whiteboards/hooks/use-whiteboard-editor';
import useWhiteboardSync from '@/modules/whiteboards/hooks/use-whiteboard-sync';
import { applyWhiteboardDrawRequest } from '@/modules/whiteboards/utils/whiteboard-draw';
import { useWhiteboardEditorHandleStore } from '@/modules/whiteboards/store/use-whiteboard-editor-handle-store';
import type { WhiteboardDrawRequest } from '@/modules/whiteboards/store/use-whiteboard-editor-handle-store';
import {
    filterPersistableAppState,
    normalizeWhiteboardRuntimeAppState
} from '@/modules/whiteboards/utils/whiteboards';
import { useCallback, useEffect, useRef } from 'react';
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

const createSceneSignature = (elements: WhiteboardElements, appState: WhiteboardAppState): string => JSON.stringify({
    elements: elements.map((element) => [
        element.id,
        element.version,
        element.versionNonce,
        element.updated,
        element.isDeleted
    ]),
    appState: filterPersistableAppState(appState)
});

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
        generateIdForFile,
        prepareImageAsset
    } = useWhiteboardEditor({ whiteboardId });

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
            sendDelta(mutableElements, mutableAppState);
        },
        [handleChange, sendDelta]
    );

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
