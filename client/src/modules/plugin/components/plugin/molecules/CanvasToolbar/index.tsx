import { PluginBuilderSaveStatus } from '@/modules/plugin/components/plugin/organisms/PluginBuilder/save-status';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Divider from '@/shared/presentation/components/Divider';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Tooltip from '@/shared/presentation/components/Tooltip';
import { useReactFlow } from '@xyflow/react';
import { ZoomIn, ZoomOut, Maximize, Save, Check, AlertTriangle } from 'lucide-react';
import { useCallback } from 'react';

interface CanvasToolbarProps {
    saveStatus: PluginBuilderSaveStatus;
    onSave: () => void;
    zoom: number;
};

const CanvasToolbar = ({ saveStatus, onSave, zoom }: CanvasToolbarProps) => {
    const { zoomIn, zoomOut, fitView } = useReactFlow();
    const zoomPercent = Math.round(zoom * 100);
    const validationResult = usePluginBuilderStore((state) => state.validationResult);
    const validationErrors = validationResult?.errors ?? [];
    const hasErrors = Boolean(validationResult && !validationResult.valid && validationErrors.length > 0);
    const validationSummary = validationErrors.join(' · ');

    let saveStatusMessage: string | null = null;
    if (saveStatus === PluginBuilderSaveStatus.Saving) {
        saveStatusMessage = 'Saving workflow.';
    } else if (saveStatus === PluginBuilderSaveStatus.Saved) {
        saveStatusMessage = 'Workflow saved.';
    } else if (saveStatus === PluginBuilderSaveStatus.Error) {
        saveStatusMessage = 'Workflow save failed.';
    }

    const handleZoomIn = useCallback(() => { zoomIn(); }, [zoomIn]);
    const handleZoomOut = useCallback(() => { zoomOut(); }, [zoomOut]);
    const handleFitView = useCallback(() => { fitView({ padding: 0.2 }); }, [fitView]);

    return (
        <Container className='p-absolute z-10 center-x d-flex items-center gap-05 b-soft radius-full canvas-toolbar' role='toolbar' aria-label='Canvas controls'>
            {saveStatusMessage && (
                <Container className='plugin-accessible-status' role='status' aria-live='polite'>
                    {saveStatusMessage}
                </Container>
            )}

            {saveStatus === PluginBuilderSaveStatus.Saving && (
                <Container className='d-flex items-center gap-05 canvas-toolbar-status'>
                    <Container className='f-shrink-0 radius-full canvas-toolbar-status-dot' />
                    <Paragraph className='font-size-2 color-secondary'>Saving...</Paragraph>
                </Container>
            )}
            {saveStatus === PluginBuilderSaveStatus.Saved && (
                <Container className='d-flex items-center gap-05 canvas-toolbar-status canvas-toolbar-status--saved'>
                    <Check size={14} />
                    <Paragraph className='font-size-2'>Saved</Paragraph>
                </Container>
            )}
            {saveStatus === PluginBuilderSaveStatus.Error && (
                <Container className='d-flex items-center gap-05 canvas-toolbar-status canvas-toolbar-status--error'>
                    <AlertTriangle size={14} />
                    <Paragraph className='font-size-2'>Save failed</Paragraph>
                </Container>
            )}

            {hasErrors && (
                <Tooltip
                    content={validationSummary}
                    placement='top'
                >
                    <Container className='d-flex items-center gap-05 canvas-toolbar-status canvas-toolbar-status--error cursor-pointer' title={validationSummary}>
                        <AlertTriangle size={14} />
                        <Paragraph className='font-size-2'>
                            {validationErrors.length} {validationErrors.length === 1 ? 'issue' : 'issues'}
                        </Paragraph>
                    </Container>
                </Tooltip>
            )}

            <Container className='d-flex items-center gap-025'>
                <Tooltip content='Zoom out' placement='top'>
                    <Button variant='ghost' intent='neutral' iconOnly size='sm' className='canvas-toolbar-action' aria-label='Zoom out' title='Zoom out' onClick={handleZoomOut}>
                        <ZoomOut size={16} />
                    </Button>
                </Tooltip>
                <Paragraph className='text-center u-select-none canvas-toolbar-zoom-label color-secondary font-size-2'>
                    {zoomPercent}%
                </Paragraph>
                <Tooltip content='Zoom in' placement='top'>
                    <Button variant='ghost' intent='neutral' iconOnly size='sm' className='canvas-toolbar-action' aria-label='Zoom in' title='Zoom in' onClick={handleZoomIn}>
                        <ZoomIn size={16} />
                    </Button>
                </Tooltip>
                <Divider orientation='vertical' className='canvas-toolbar-divider' />
                <Tooltip content='Fit to view' placement='top'>
                    <Button variant='ghost' intent='neutral' iconOnly size='sm' className='canvas-toolbar-action' aria-label='Fit to view' title='Fit to view' onClick={handleFitView}>
                        <Maximize size={16} />
                    </Button>
                </Tooltip>
            </Container>

            <Tooltip content='Save (Ctrl+S)' placement='top'>
                <Button
                    variant='ghost'
                    intent='neutral'
                    iconOnly
                    size='sm'
                    className='canvas-toolbar-action'
                    aria-label='Save workflow'
                    onClick={onSave}
                    disabled={saveStatus === PluginBuilderSaveStatus.Saving}
                    title='Save workflow'
                >
                    <Save size={16} />
                </Button>
            </Tooltip>
        </Container>
    );
};

export default CanvasToolbar;
