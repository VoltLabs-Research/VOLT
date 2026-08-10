import { Button } from '@heroui/react';
import WhiteboardEditorSkeleton from './WhiteboardEditorSkeleton';
import useWhiteboardCanvasBridge from '@/modules/whiteboards/hooks/use-whiteboard-canvas-bridge';
import useWhiteboardImageInsertion from '@/modules/whiteboards/hooks/use-whiteboard-image-insertion';
import useWhiteboardPresence from '@/modules/whiteboards/hooks/use-whiteboard-presence';
import useDashboardWorkspaceChrome from '@/modules/dashboard/hooks/use-dashboard-workspace-chrome';
import { usePageTitle } from '@/shared/ui/hooks/use-page-title';
import { requestIdleCallbackHandle } from '@/shared/ui/utils/idle-callback';
import useTip from '@/shared/tips/use-tip';
import { useCallback, useEffect, useState, lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { RenderTopRightUI } from '@/modules/whiteboards/contracts/excalidraw';
import { ImagePlus } from 'lucide-react';
import '@excalidraw/excalidraw/index.css';

const AI_ASSISTANT_IDLE_FALLBACK_DELAY_MS = 250;

/**
 * The Suspense fallback for the AI panel, which mounts inside Excalidraw's own
 * toolbar and so has to look like part of it rather than like a HeroUI control.
 *
 * `border` and `bg-surface-secondary` are restored deliberately: the stylesheet asked
 * for `var(--color-border-primary)` and `var(--color-surface-secondary)`, neither of
 * which was ever defined, and an invalid `border:` shorthand removes the border
 * outright — so this button has been rendering edgeless and transparent.
 */
const AI_LOADING_BUTTON_CLASS_NAMES = 'rounded-full border border-border bg-surface-secondary px-3.5 py-2 text-foreground [font:inherit] cursor-pointer';

const WhiteboardCanvas = lazy(
    () => import('./WhiteboardCanvas')
);

const LazyAIFloatingAssistantPanel = lazy(
    () => import('@/modules/ai/components/AIFloatingAssistantPanel')
);

const WhiteboardEditorPage = () => {
    const { whiteboardId } = useParams<{ whiteboardId: string }>();
    const navigate = useNavigate();
    const resolvedWhiteboardId = whiteboardId ?? '';
    const [shouldRenderAIAssistant, setShouldRenderAIAssistant] = useState(false);

    const {
        whiteboard,
        isLoading,
        excalidrawApiRef,
        excalidrawInitialData,
        generateIdForFile,
        prepareImageAsset,
        handleExcalidrawChange,
        handleExcalidrawAPI
    } = useWhiteboardCanvasBridge({ whiteboardId: resolvedWhiteboardId });

    const {
        imageFileInputRef,
        handleOpenImagePicker,
        handleImagePickerChange,
        handleCanvasDragOver,
        handleCanvasDrop,
        handleCanvasPasteCapture
    } = useWhiteboardImageInsertion({
        excalidrawApiRef,
        prepareImageAsset
    });

    usePageTitle(whiteboard?.title ?? 'Whiteboard');
    useDashboardWorkspaceChrome({ hideHeader: true });

    const { announcement, users } = useWhiteboardPresence({
        whiteboardId,
        enabled: Boolean(resolvedWhiteboardId)
    });

    useTip('whiteboard-collaboration', {
        enabled: Boolean(resolvedWhiteboardId) && !isLoading
    });

    const handleBack = useCallback(() => navigate('/dashboard/whiteboards'), [navigate]);

    useEffect(() => {
        const idleCallbackHandle = requestIdleCallbackHandle(() => {
            setShouldRenderAIAssistant(true);
        }, { fallbackDelayMs: AI_ASSISTANT_IDLE_FALLBACK_DELAY_MS });

        return () => {
            idleCallbackHandle.cancel();
        };
    }, []);

    let aiAssistantControl: ReactNode = null;
    if (shouldRenderAIAssistant) {
        aiAssistantControl = (
            <Suspense fallback={(
                <button
                    type='button'
                    disabled
                    className={AI_LOADING_BUTTON_CLASS_NAMES}
                    aria-label='Loading the Volt AI assistant'
                >
                    Loading AI...
                </button>
            )}>
                <LazyAIFloatingAssistantPanel />
            </Suspense>
        );
    }

    const renderTopRightUI = useCallback<RenderTopRightUI>((isMobile) => {
        const collaboratorsLabel = users.length === 1 ? '1 collaborator online' : `${users.length} collaborators online`;
        const insertImageControl = isMobile ? (
            <Button
                variant='secondary'
                size='sm'
                isIconOnly
                aria-label='Insert image'
                onPress={handleOpenImagePicker}
            >
                <ImagePlus size={16} />
            </Button>
        ) : (
            <Button
                variant='secondary'
                size='sm'
                onPress={handleOpenImagePicker}
            >
                <ImagePlus size={16} />
                Insert image
            </Button>
        );

        return (
            <div className='flex flex-row items-center gap-2 px-2 text-xs text-muted'>
                {users.length > 0 && (
                    <div className='max-w-[16rem] truncate' aria-label={collaboratorsLabel}>
                        {collaboratorsLabel}
                    </div>
                )}
                {insertImageControl}
                {aiAssistantControl}
            </div>
        );
    }, [aiAssistantControl, handleOpenImagePicker, users]);

    if (!whiteboardId) {
        return null;
    }

    return (
        <div className='box-border w-full h-full p-2'>
            <span className='sr-only' aria-live='polite' aria-atomic='true'>
                {announcement?.message ?? ''}
            </span>
            <input
                ref={imageFileInputRef}
                type='file'
                accept='image/*'
                multiple
                className='sr-only'
                onChange={handleImagePickerChange}
            />
            {isLoading ? (
                <WhiteboardEditorSkeleton />
            ) : (
                <Suspense fallback={<WhiteboardEditorSkeleton />}>
                    <WhiteboardCanvas
                        name={whiteboard?.title ?? 'Untitled Whiteboard'}
                        initialData={excalidrawInitialData}
                        onChange={handleExcalidrawChange}
                        generateIdForFile={generateIdForFile}
                        renderTopRightUI={renderTopRightUI}
                        onExcalidrawAPI={handleExcalidrawAPI}
                        onInsertImage={handleOpenImagePicker}
                        onCanvasPasteCapture={handleCanvasPasteCapture}
                        onCanvasDragOver={handleCanvasDragOver}
                        onCanvasDrop={handleCanvasDrop}
                        onBack={handleBack}
                    />
                </Suspense>
            )}
        </div>
    );
};

export default WhiteboardEditorPage;
