import useWhiteboardEditor from '@/modules/whiteboards/hooks/use-whiteboard-editor';
import useWhiteboardPresence from '@/modules/whiteboards/hooks/use-whiteboard-presence';
import useWhiteboardSync from '@/modules/whiteboards/hooks/use-whiteboard-sync';
import Container from '@/shared/presentation/components/Container';
import Loader from '@/shared/presentation/components/Loader';
import { useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import type { Excalidraw as ExcalidrawComponent } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import './WhiteboardEditorPage.css';

const Excalidraw = lazy(() =>
    import('@excalidraw/excalidraw').then((module) => ({ default: module.Excalidraw }))
);

type ExcalidrawProps = React.ComponentProps<typeof ExcalidrawComponent>;
type ExcalidrawAPICallback = NonNullable<ExcalidrawProps['excalidrawAPI']>;
type ExcalidrawAPI = Parameters<ExcalidrawAPICallback>[0];
type ExcalidrawChangeHandler = NonNullable<ExcalidrawProps['onChange']>;
type ExcalidrawElements = Parameters<ExcalidrawChangeHandler>[0];
type ExcalidrawAppState = Parameters<ExcalidrawChangeHandler>[1];

const WhiteboardEditorPage = () => {
    const { whiteboardId } = useParams<{ whiteboardId: string }>();
    const navigate = useNavigate();
    const excalidrawApiRef = useRef<ExcalidrawAPI | null>(null);

    const {
        whiteboard,
        initialState,
        isLoading,
        isSaving,
        handleChange,
        generateIdForFile
    } = useWhiteboardEditor({ whiteboardId: whiteboardId! });

    const { users } = useWhiteboardPresence({
        whiteboardId,
        enabled: Boolean(whiteboardId)
    });

    const handleRemoteDelta = useCallback(
        (elements: Record<string, unknown>[], appState: Record<string, unknown>) => {
            excalidrawApiRef.current?.updateScene({
                elements: elements as unknown as ExcalidrawElements,
                appState: appState as unknown as ExcalidrawAppState
            });
        },
        []
    );

    const { sendDelta } = useWhiteboardSync({
        whiteboardId,
        enabled: Boolean(whiteboardId),
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

    useEffect(() => {
        document.body.classList.add('whiteboard-editor-fullscreen');
        return () => {
            document.body.classList.remove('whiteboard-editor-fullscreen');
        };
    }, []);

    const handleBack = () => navigate('/dashboard/whiteboards');

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
            <Container className='whiteboard-editor-toolbar'>
                <button className='whiteboard-editor-back-btn' onClick={handleBack}>
                    <ArrowLeft size={16} />
                    <span>Whiteboards</span>
                </button>
                <span className='whiteboard-editor-title'>
                    {whiteboard?.title || 'Untitled Whiteboard'}
                </span>
                <Container className='whiteboard-editor-presence'>
                    {users.length > 0 && (
                        <span className='whiteboard-editor-users'>
                            {users.length} online
                        </span>
                    )}
                    {isSaving && (
                        <span className='whiteboard-editor-saving'>Saving...</span>
                    )}
                </Container>
            </Container>
            <Container className='whiteboard-editor-canvas'>
                {isLoading ? (
                    <Container className='whiteboard-editor-loading'>
                        <Loader scale={0.8} />
                    </Container>
                ) : (
                    <Suspense fallback={<Loader scale={0.8} />}>
                        <Excalidraw
                            excalidrawAPI={handleExcalidrawAPI}
                            initialData={excalidrawInitialData}
                            onChange={handleExcalidrawChange}
                            generateIdForFile={generateIdForFile}
                        />
                    </Suspense>
                )}
            </Container>
        </Container>
    );
};

export default WhiteboardEditorPage;
