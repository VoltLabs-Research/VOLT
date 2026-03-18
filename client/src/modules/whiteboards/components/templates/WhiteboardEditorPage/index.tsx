import useWhiteboardEditor from '@/modules/whiteboards/hooks/use-whiteboard-editor';
import useWhiteboardPresence from '@/modules/whiteboards/hooks/use-whiteboard-presence';
import useWhiteboardSync from '@/modules/whiteboards/hooks/use-whiteboard-sync';
import { DASHBOARD_LAYOUT_EVENTS } from '@/modules/dashboard/utilities/layout-events';
import { filterPersistableAppState } from '@/modules/whiteboards/utilities/whiteboards';
import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import useTip from '@/shared/tips/use-tip';
import AIFloatingAssistantPanel from '@/modules/ai/components/organisms/AIFloatingAssistantPanel';
import { useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import type { ComponentProps } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Excalidraw as ExcalidrawComponent } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import './WhiteboardEditorPage.css';

type ExcalidrawProps = ComponentProps<typeof ExcalidrawComponent>;
type ExcalidrawAPICallback = NonNullable<ExcalidrawProps['excalidrawAPI']>;
type ExcalidrawAPI = Parameters<ExcalidrawAPICallback>[0];
type ExcalidrawChangeHandler = NonNullable<ExcalidrawProps['onChange']>;
type ExcalidrawElements = Parameters<ExcalidrawChangeHandler>[0];
type ExcalidrawAppState = Parameters<ExcalidrawChangeHandler>[1];
type ExcalidrawFiles = Parameters<ExcalidrawChangeHandler> extends [unknown, unknown, infer T, ...unknown[]] ? T : Record<string, unknown>;
type ExcalidrawSceneFiles = ExcalidrawProps['initialData'] extends { files?: infer T } ? T : Record<string, unknown>;
type RenderTopRightUI = NonNullable<ExcalidrawProps['renderTopRightUI']>;

const createSceneSignature = (elements: Record<string, unknown>[], appState: Record<string, unknown>) => {
    const elementSignature = elements.map((element) => [
        element.id,
        element.version,
        element.versionNonce,
        element.updated,
        element.isDeleted
    ]);

    return JSON.stringify({
        elements: elementSignature,
        appState: filterPersistableAppState(appState)
    });
};

const WhiteboardCanvas = lazy(
    () => import('./WhiteboardCanvas')
);

const WhiteboardEditorPage = () => {
    const { whiteboardId } = useParams<{ whiteboardId: string }>();
    const navigate = useNavigate();
    const excalidrawApiRef = useRef<ExcalidrawAPI | null>(null);
    const pendingSceneRef = useRef<{ elements: Record<string, unknown>[]; appState: Record<string, unknown>; files?: Record<string, unknown>; } | null>(null);
    const ignoredSceneSignatureRef = useRef<string | null>(null);

    const {
        whiteboard,
        initialState,
        isLoading,
        handleChange,
        mergeRemoteState,
        generateIdForFile
    } = useWhiteboardEditor({ whiteboardId: whiteboardId! });

    usePageTitle(whiteboard?.title ?? 'Whiteboard');

    const { announcement, users } = useWhiteboardPresence({
        whiteboardId,
        enabled: Boolean(whiteboardId)
    });

    useTip('whiteboard-collaboration', {
        enabled: Boolean(whiteboardId) && !isLoading
    });

    const handleRemoteState = useCallback(
        async (elements: Record<string, unknown>[], appState: Record<string, unknown>, revision: number) => {
            const mergedState = await mergeRemoteState(elements, appState, revision);
            const scene = {
                elements: mergedState.elements,
                appState: mergedState.appState,
                files: mergedState.files
            };

            pendingSceneRef.current = scene;

            if (!excalidrawApiRef.current) {
                return;
            }

            ignoredSceneSignatureRef.current = createSceneSignature(scene.elements, scene.appState);
            excalidrawApiRef.current.updateScene({
                elements: scene.elements as unknown as ExcalidrawElements,
                appState: scene.appState as unknown as ExcalidrawAppState,
                files: scene.files as ExcalidrawSceneFiles
            });
        },
        [mergeRemoteState]
    );

    const { sendDelta } = useWhiteboardSync({
        whiteboardId,
        enabled: Boolean(whiteboardId),
        onRemoteState: handleRemoteState
    });

    const handleExcalidrawChange = useCallback<ExcalidrawChangeHandler>(
        (elements: ExcalidrawElements, appState: ExcalidrawAppState, files?: ExcalidrawFiles) => {
            const mutableElements = elements as unknown as Record<string, unknown>[];
            const mutableAppState = appState as unknown as Record<string, unknown>;
            const currentSceneSignature = createSceneSignature(mutableElements, mutableAppState);

            if (ignoredSceneSignatureRef.current === currentSceneSignature) {
                ignoredSceneSignatureRef.current = null;
                return;
            }

            handleChange(
                mutableElements,
                mutableAppState,
                (files ?? undefined) as Record<string, unknown> | undefined
            );
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
        api.updateScene({
            elements: pendingScene.elements as unknown as ExcalidrawElements,
            appState: pendingScene.appState as unknown as ExcalidrawAppState,
            files: pendingScene.files as ExcalidrawSceneFiles
        });
    }, []);

    const handleBack = useCallback(() => navigate('/dashboard/whiteboards'), [navigate]);

    useEffect(() => {
        window.dispatchEvent(new CustomEvent(DASHBOARD_LAYOUT_EVENTS.requestHeaderHide));

        return () => {
            window.dispatchEvent(new CustomEvent(DASHBOARD_LAYOUT_EVENTS.requestHeaderShow));
        };
    }, []);

    const renderTopRightUI = useCallback<RenderTopRightUI>(() => {
        const collaboratorsLabel = users.length === 1 ? '1 collaborator online' : `${users.length} collaborators online`;

        return (
            <div className='whiteboard-presence-indicator d-flex items-center gap-05'>
                {users.length > 0 && (
                    <div className='whiteboard-presence-count' aria-label={collaboratorsLabel}>
                        {collaboratorsLabel}
                    </div>
                )}
                <AIFloatingAssistantPanel />
            </div>
        );
    }, [users]);

    if (!whiteboardId) {
        return null;
    }

    // Cast from JSON-serialized state to Excalidraw types at the boundary.
    const excalidrawInitialData = {
        elements: initialState?.elements ?? [],
        appState: initialState?.appState ?? {},
        files: initialState?.files
    } as unknown as ExcalidrawProps['initialData'];

    return (
        <Container className='whiteboard-editor-root'>
            <span className='whiteboard-presence-live-region' aria-live='polite' aria-atomic='true'>
                {announcement?.message ?? ''}
            </span>
            {isLoading ? (
                <Container className='whiteboard-editor-loading'>
                    <Loader scale={0.8} />
                </Container>
            ) : (
                <Suspense fallback={<Loader scale={0.8} />}>
                    <WhiteboardCanvas
                        name={whiteboard?.title ?? 'Untitled Whiteboard'}
                        initialData={excalidrawInitialData}
                        onChange={handleExcalidrawChange}
                        generateIdForFile={generateIdForFile}
                        renderTopRightUI={renderTopRightUI}
                        onExcalidrawAPI={handleExcalidrawAPI}
                        onBack={handleBack}
                    />
                </Suspense>
            )}
        </Container>
    );
};

export default WhiteboardEditorPage;
