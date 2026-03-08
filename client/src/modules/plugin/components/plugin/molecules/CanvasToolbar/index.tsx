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
    saveStatus: 'idle' | 'saving' | 'saved' | 'error';
    onSave: () => void;
    zoom: number;
};

const CanvasToolbar = ({ saveStatus, onSave, zoom }: CanvasToolbarProps) => {
    const { zoomIn, zoomOut, fitView } = useReactFlow();
    const zoomPercent = Math.round(zoom * 100);
    const validationResult = usePluginBuilderStore((state) => state.validationResult);
    const hasErrors = validationResult && !validationResult.valid && validationResult.errors.length > 0;

    const handleZoomIn = useCallback(() => { zoomIn(); }, [zoomIn]);
    const handleZoomOut = useCallback(() => { zoomOut(); }, [zoomOut]);
    const handleFitView = useCallback(() => { fitView({ padding: 0.2 }); }, [fitView]);

    return (
        <Container className='p-absolute z-10 center-x d-flex items-center gap-05 b-soft radius-full canvas-toolbar'>
            {saveStatus === 'saving' && (
                <Container className='d-flex items-center gap-05 canvas-toolbar-status'>
                    <Container className='f-shrink-0 radius-full canvas-toolbar-status-dot' />
                    <Paragraph className='font-size-2 color-secondary'>Saving...</Paragraph>
                </Container>
            )}
            {saveStatus === 'saved' && (
                <Container className='d-flex items-center gap-05 canvas-toolbar-status canvas-toolbar-status--saved'>
                    <Check size={14} />
                    <Paragraph className='font-size-2'>Saved</Paragraph>
                </Container>
            )}
            {saveStatus === 'error' && (
                <Container className='d-flex items-center gap-05 canvas-toolbar-status canvas-toolbar-status--error'>
                    <AlertTriangle size={14} />
                    <Paragraph className='font-size-2'>Error</Paragraph>
                </Container>
            )}

            {hasErrors && (
                <Tooltip
                    content={validationResult!.errors.join(' · ')}
                    placement='top'
                >
                    <Container className='d-flex items-center gap-05 canvas-toolbar-status canvas-toolbar-status--error cursor-pointer'>
                        <AlertTriangle size={14} />
                        <Paragraph className='font-size-2'>
                            {validationResult!.errors.length} {validationResult!.errors.length === 1 ? 'issue' : 'issues'}
                        </Paragraph>
                    </Container>
                </Tooltip>
            )}

            <Container className='d-flex items-center gap-025'>
                <Tooltip content='Zoom out' placement='top'>
                    <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={handleZoomOut}>
                        <ZoomOut size={16} />
                    </Button>
                </Tooltip>
                <Paragraph className='text-center u-select-none canvas-toolbar-zoom-label color-secondary font-size-2'>
                    {zoomPercent}%
                </Paragraph>
                <Tooltip content='Zoom in' placement='top'>
                    <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={handleZoomIn}>
                        <ZoomIn size={16} />
                    </Button>
                </Tooltip>
                <Divider orientation='vertical' className='canvas-toolbar-divider' />
                <Tooltip content='Fit to view' placement='top'>
                    <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={handleFitView}>
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
                    onClick={onSave}
                    disabled={saveStatus === 'saving'}
                >
                    <Save size={16} />
                </Button>
            </Tooltip>
        </Container>
    );
};

export default CanvasToolbar;
