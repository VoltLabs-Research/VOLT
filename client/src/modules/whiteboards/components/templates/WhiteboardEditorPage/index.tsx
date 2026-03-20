import useWhiteboardEditor from '@/modules/whiteboards/hooks/use-whiteboard-editor';
import useWhiteboardPresence from '@/modules/whiteboards/hooks/use-whiteboard-presence';
import useWhiteboardSync from '@/modules/whiteboards/hooks/use-whiteboard-sync';
import useDashboardWorkspaceChrome from '@/modules/dashboard/hooks/use-dashboard-workspace-chrome';
import { filterPersistableAppState } from '@/modules/whiteboards/utilities/whiteboards';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import Container from '@/shared/presentation/components/Container';
import useTip from '@/shared/tips/use-tip';
import { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import type { ComponentProps, CSSProperties, ReactNode } from 'react';
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
type RenderTopRightUI = NonNullable<ExcalidrawProps['renderTopRightUI']>;

interface IdleCallbackHandle {
    cancel: () => void;
};

const loadingShellStyles = {
    root: {
        width: 'min(1200px, calc(100vw - 2rem))',
        height: 'min(780px, calc(100vh - 2rem))',
        padding: '1rem',
        borderRadius: '1.25rem',
        border: '1px solid var(--color-border-primary)',
        background: 'linear-gradient(180deg, var(--color-surface-primary) 0%, var(--color-surface-secondary) 100%)',
        boxShadow: 'var(--shadow-card)'
    },
    toolbar: {
        height: '4rem',
        padding: '0.75rem 1rem',
        borderRadius: '1rem',
        border: '1px solid var(--color-border-primary)',
        background: 'var(--color-surface-secondary)'
    },
    chip: {
        height: '0.875rem',
        borderRadius: '999px',
        background: 'var(--color-surface-tertiary)'
    },
    sidebar: {
        width: '18rem',
        minWidth: '15rem',
        padding: '1rem',
        borderRadius: '1rem',
        border: '1px solid var(--color-border-primary)',
        background: 'var(--color-surface-secondary)'
    },
    canvas: {
        minHeight: '24rem',
        flex: 1,
        padding: '1rem',
        borderRadius: '1rem',
        border: '1px solid var(--color-border-primary)',
        background: 'radial-gradient(circle at top left, var(--color-surface-tertiary) 0%, var(--color-surface-primary) 60%)'
    },
    line: {
        width: '100%',
        height: '0.875rem',
        borderRadius: '999px',
        background: 'var(--color-surface-tertiary)'
    },
    floatingPanel: {
        width: '18rem',
        maxWidth: '100%',
        padding: '0.875rem 1rem',
        borderRadius: '1rem',
        border: '1px solid var(--color-border-primary)',
        background: 'var(--color-surface-secondary)'
    },
    aiButton: {
        border: '1px solid var(--color-border-primary)',
        borderRadius: '999px',
        padding: '0.5rem 0.875rem',
        background: 'var(--color-surface-secondary)',
        color: 'var(--color-text-primary)',
        font: 'inherit',
        cursor: 'pointer'
    }
} satisfies Record<string, CSSProperties>;

const syncSceneFiles = (api: ExcalidrawAPI, files?: Record<string, unknown>) => {
    if (!files) {
        return;
    }

    const nextFiles = Object.values(files);
    if (nextFiles.length === 0) {
        return;
    }

    api.addFiles(nextFiles as Parameters<ExcalidrawAPI['addFiles']>[0]);
};

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

const LazyAIFloatingAssistantPanel = lazy(
    () => import('@/modules/ai/components/organisms/AIFloatingAssistantPanel')
);

const createIdleCallbackHandle = (onIdle: () => void): IdleCallbackHandle => {
    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        const idleCallbackId = window.requestIdleCallback(onIdle, { timeout: 1500 });

        return {
            cancel: () => {
                window.cancelIdleCallback(idleCallbackId);
            }
        };
    }

    const timeoutId = window.setTimeout(onIdle, 250);

    return {
        cancel: () => {
            window.clearTimeout(timeoutId);
        }
    };
};

const renderLoadingShell = (): ReactNode => (
    <Container className='whiteboard-editor-loading d-flex items-center justify-center p-1'>
        <div style={loadingShellStyles.root} role='status' aria-live='polite' aria-label='Loading whiteboard workspace'>
            <div className='d-flex column gap-1 h-100'>
                <div className='d-flex items-center justify-between gap-1' style={loadingShellStyles.toolbar}>
                    <div className='d-flex items-center gap-05 flex-1'>
                        <div style={{ ...loadingShellStyles.chip, width: '8rem' }} />
                        <div style={{ ...loadingShellStyles.chip, width: '5rem' }} />
                    </div>
                    <div className='d-flex items-center gap-05'>
                        <div style={{ ...loadingShellStyles.chip, width: '2.5rem' }} />
                        <div style={{ ...loadingShellStyles.chip, width: '2.5rem' }} />
                        <div style={{ ...loadingShellStyles.chip, width: '2.5rem' }} />
                    </div>
                </div>

                <div className='d-flex gap-1 flex-1' style={{ flexWrap: 'wrap' }}>
                    <div className='d-flex column gap-075' style={loadingShellStyles.sidebar}>
                        <div style={{ ...loadingShellStyles.line, width: '70%' }} />
                        <div style={{ ...loadingShellStyles.line, width: '100%' }} />
                        <div style={{ ...loadingShellStyles.line, width: '88%' }} />
                        <div style={{ ...loadingShellStyles.line, width: '92%' }} />
                        <div style={{ ...loadingShellStyles.line, width: '74%' }} />
                    </div>

                    <div className='d-flex column justify-between gap-1' style={loadingShellStyles.canvas}>
                        <div className='d-flex gap-05'>
                            <div style={{ ...loadingShellStyles.chip, width: '6rem' }} />
                            <div style={{ ...loadingShellStyles.chip, width: '4rem' }} />
                        </div>
                        <div className='d-flex justify-center'>
                            <div style={{ ...loadingShellStyles.line, width: '72%', height: '1rem' }} />
                        </div>
                        <div className='d-flex justify-between items-end gap-1'>
                            <div style={{ ...loadingShellStyles.line, width: '28%', height: '9rem', borderRadius: '1rem' }} />
                            <div style={{ ...loadingShellStyles.line, width: '38%', height: '13rem', borderRadius: '1rem' }} />
                            <div style={{ ...loadingShellStyles.line, width: '22%', height: '7rem', borderRadius: '1rem' }} />
                        </div>
                    </div>
                </div>

                <div className='d-flex justify-end'>
                    <div className='d-flex column gap-05' style={loadingShellStyles.floatingPanel}>
                        <div style={{ ...loadingShellStyles.line, width: '45%' }} />
                        <div style={{ ...loadingShellStyles.line, width: '100%' }} />
                        <div style={{ ...loadingShellStyles.line, width: '82%' }} />
                    </div>
                </div>
            </div>
        </div>
    </Container>
);

const WhiteboardEditorPage = () => {
    const { whiteboardId } = useParams<{ whiteboardId: string }>();
    const navigate = useNavigate();
    const resolvedWhiteboardId = whiteboardId ?? '';
    const excalidrawApiRef = useRef<ExcalidrawAPI | null>(null);
    const pendingSceneRef = useRef<{ elements: Record<string, unknown>[]; appState: Record<string, unknown>; files?: Record<string, unknown>; } | null>(null);
    const ignoredSceneSignatureRef = useRef<string | null>(null);
    const [shouldRenderAIAssistant, setShouldRenderAIAssistant] = useState(false);

    const {
        whiteboard,
        initialState,
        isLoading,
        handleChange,
        mergeRemoteState,
        generateIdForFile
    } = useWhiteboardEditor({ whiteboardId: resolvedWhiteboardId });

    usePageTitle(whiteboard?.title ?? 'Whiteboard');
    useDashboardWorkspaceChrome({ hideHeader: true });

    const { announcement, users } = useWhiteboardPresence({
        whiteboardId,
        enabled: Boolean(resolvedWhiteboardId)
    });

    useTip('whiteboard-collaboration', {
        enabled: Boolean(resolvedWhiteboardId) && !isLoading
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
            syncSceneFiles(excalidrawApiRef.current, scene.files);
            excalidrawApiRef.current.updateScene({
                elements: scene.elements as unknown as ExcalidrawElements,
                appState: scene.appState as unknown as ExcalidrawAppState
            });
        },
        [mergeRemoteState]
    );

    const { sendDelta } = useWhiteboardSync({
        whiteboardId,
        enabled: Boolean(resolvedWhiteboardId),
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
        syncSceneFiles(api, pendingScene.files);
        api.updateScene({
            elements: pendingScene.elements as unknown as ExcalidrawElements,
            appState: pendingScene.appState as unknown as ExcalidrawAppState
        });
    }, []);

    const handleBack = useCallback(() => navigate('/dashboard/whiteboards'), [navigate]);

    useEffect(() => {
        if (shouldRenderAIAssistant) {
            return;
        }

        const idleCallbackHandle = createIdleCallbackHandle(() => {
            setShouldRenderAIAssistant(true);
        });

        return () => {
            idleCallbackHandle.cancel();
        };
    }, [shouldRenderAIAssistant]);

    let aiAssistantControl: ReactNode = null;
    if (shouldRenderAIAssistant) {
        aiAssistantControl = (
            <Suspense fallback={(
                <button
                    type='button'
                    disabled
                    style={loadingShellStyles.aiButton}
                    aria-label='Loading the Volt AI assistant'
                >
                    Loading AI...
                </button>
            )}>
                <LazyAIFloatingAssistantPanel />
            </Suspense>
        );
    }

    const renderTopRightUI = useCallback<RenderTopRightUI>(() => {
        const collaboratorsLabel = users.length === 1 ? '1 collaborator online' : `${users.length} collaborators online`;

        return (
            <div className='whiteboard-presence-indicator d-flex items-center gap-05'>
                {users.length > 0 && (
                    <div className='whiteboard-presence-count' aria-label={collaboratorsLabel}>
                        {collaboratorsLabel}
                    </div>
                )}
                {aiAssistantControl}
            </div>
        );
    }, [aiAssistantControl, users]);

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
                renderLoadingShell()
            ) : (
                <Suspense fallback={renderLoadingShell()}>
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
