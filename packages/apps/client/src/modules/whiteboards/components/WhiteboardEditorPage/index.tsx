import { Button } from '@heroui/react';
import WhiteboardEditorLoader from './WhiteboardEditorLoader';
import useWhiteboardCanvasBridge from './use-whiteboard-canvas-bridge';
import useWhiteboardImageInsertion from './use-whiteboard-image-insertion';
import useWhiteboardPresence from './use-whiteboard-presence';
import useDashboardWorkspaceChrome from '@/modules/dashboard/hooks/use-dashboard-workspace-chrome';
import { useSingleTenant } from '@/modules/system/hooks/use-single-tenant';
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

    const singleTenant = useSingleTenant();
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
            <Suspense fallback={null}>
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
                {!singleTenant && users.length > 0 && (
                    <div className='max-w-[16rem] truncate' aria-label={collaboratorsLabel}>
                        {collaboratorsLabel}
                    </div>
                )}
                {insertImageControl}
                {aiAssistantControl}
            </div>
        );
    }, [aiAssistantControl, handleOpenImagePicker, users, singleTenant]);

    if (!whiteboardId) {
        return null;
    }

    return (
        // From lg the dashboard already sets the page in by 8px on a 16px corner, the board's frame
        // in the mockup; below it the page runs edge to edge, so the board sets itself in.
        <div className='h-full w-full max-lg:p-2'>
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
                <WhiteboardEditorLoader />
            ) : (
                <Suspense fallback={<WhiteboardEditorLoader />}>
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
