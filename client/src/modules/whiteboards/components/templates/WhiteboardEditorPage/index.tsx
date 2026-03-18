import useWhiteboardEditor from '@/modules/whiteboards/hooks/use-whiteboard-editor';
import useWhiteboardPresence from '@/modules/whiteboards/hooks/use-whiteboard-presence';
import useWhiteboardSync from '@/modules/whiteboards/hooks/use-whiteboard-sync';
import { DASHBOARD_LAYOUT_EVENTS } from '@/modules/dashboard/utilities/layout-events';
import { filterPersistableAppState } from '@/modules/whiteboards/utilities/whiteboards';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
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
type RenderTopRightUI = NonNullable<ExcalidrawProps['renderTopRightUI']>;

const WhiteboardCanvas = lazy(
    () => import('./WhiteboardCanvas')
);

const WhiteboardEditorPage = () => {
    const { whiteboardId } = useParams<{ whiteboardId: string }>();
    const navigate = useNavigate();
    const excalidrawApiRef = useRef<ExcalidrawAPI | null>(null);

    const {
        whiteboard,
        initialState,
        isLoading,
        hasPendingLocalChanges,
        handleChange,
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

    const handleRemoteDelta = useCallback(
        (elements: Record<string, unknown>[], appState: Record<string, unknown>) => {
            excalidrawApiRef.current?.updateScene({
                elements: elements as unknown as ExcalidrawElements,
                appState: filterPersistableAppState(appState) as unknown as ExcalidrawAppState
            });
        },
        []
    );

    const {
        sendDelta,
        hasPendingRemoteDelta,
        applyPendingRemoteDelta,
        dismissPendingRemoteDelta
    } = useWhiteboardSync({
        whiteboardId,
        enabled: Boolean(whiteboardId),
        hasPendingLocalChanges,
        onRemoteDelta: handleRemoteDelta
    });

    const handleExcalidrawChange = useCallback<ExcalidrawChangeHandler>(
        (elements: ExcalidrawElements, appState: ExcalidrawAppState) => {
            const mutableElements = elements as unknown as Record<string, unknown>[];
            handleChange(mutableElements, appState as unknown as Record<string, unknown>);
            sendDelta(mutableElements, appState as unknown as Record<string, unknown>);
        },
        [handleChange, sendDelta]
    );

    const handleExcalidrawAPI = useCallback((api: ExcalidrawAPI) => {
        excalidrawApiRef.current = api;
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
                {hasPendingRemoteDelta && (
                    <div className='d-flex items-center gap-05'>
                        <StatusBadge variant='warning' size='compact'>Remote update waiting</StatusBadge>
                        <Button variant='ghost' intent='neutral' size='sm' onClick={dismissPendingRemoteDelta}>
                            Keep mine
                        </Button>
                        <Button variant='solid' intent='brand' size='sm' onClick={applyPendingRemoteDelta}>
                            Apply remote
                        </Button>
                    </div>
                )}
                <AIFloatingAssistantPanel />
            </div>
        );
    }, [applyPendingRemoteDelta, dismissPendingRemoteDelta, hasPendingRemoteDelta, users]);

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
