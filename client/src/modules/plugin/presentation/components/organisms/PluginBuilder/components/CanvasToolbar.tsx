import { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import Tooltip from '@/shared/presentation/components/Tooltip';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Divider from '@/shared/presentation/components/Divider';
import { TbZoomIn, TbZoomOut, TbMaximize, TbDeviceFloppy, TbCheck, TbAlertTriangle } from 'react-icons/tb';

interface CanvasToolbarProps {
    saveStatus: 'idle' | 'saving' | 'saved' | 'error';
    onSave: () => void;
    zoom: number;
};

const CanvasToolbar = ({ saveStatus, onSave, zoom }: CanvasToolbarProps) => {
    const { zoomIn, zoomOut, fitView } = useReactFlow();
    const zoomPercent = Math.round(zoom * 100);

    const handleZoomIn = useCallback(() => { zoomIn(); }, [zoomIn]);
    const handleZoomOut = useCallback(() => { zoomOut(); }, [zoomOut]);
    const handleFitView = useCallback(() => { fitView({ padding: 0.2 }); }, [fitView]);

    return (
        <Container className='p-absolute z-10 d-flex items-center gap-05 b-soft radius-full canvas-toolbar'>
            {saveStatus === 'saving' && (
                <Container className='d-flex items-center gap-05 canvas-toolbar-status'>
                    <Container className='f-shrink-0 radius-full canvas-toolbar-status-dot' />
                    <Paragraph className='font-size-2 color-secondary'>Saving...</Paragraph>
                </Container>
            )}
            {saveStatus === 'saved' && (
                <Container className='d-flex items-center gap-05 canvas-toolbar-status canvas-toolbar-status--saved'>
                    <TbCheck size={14} />
                    <Paragraph className='font-size-2'>Saved</Paragraph>
                </Container>
            )}
            {saveStatus === 'error' && (
                <Container className='d-flex items-center gap-05 canvas-toolbar-status canvas-toolbar-status--error'>
                    <TbAlertTriangle size={14} />
                    <Paragraph className='font-size-2'>Error</Paragraph>
                </Container>
            )}

            <Container className='d-flex items-center gap-025'>
                <Tooltip content='Zoom out' placement='top'>
                    <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={handleZoomOut}>
                        <TbZoomOut size={16} />
                    </Button>
                </Tooltip>
                <Paragraph className='text-center u-select-none canvas-toolbar-zoom-label color-secondary font-size-2'>
                    {zoomPercent}%
                </Paragraph>
                <Tooltip content='Zoom in' placement='top'>
                    <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={handleZoomIn}>
                        <TbZoomIn size={16} />
                    </Button>
                </Tooltip>
                <Divider orientation='vertical' className='canvas-toolbar-divider' />
                <Tooltip content='Fit to view' placement='top'>
                    <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={handleFitView}>
                        <TbMaximize size={16} />
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
                    <TbDeviceFloppy size={16} />
                </Button>
            </Tooltip>
        </Container>
    );
};

export default CanvasToolbar;
