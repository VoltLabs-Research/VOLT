import { Button, FloatingToolbar, SaveStatusIndicator, Tooltip } from '@/shared/presentation/primitives';
import type { SaveStatus } from '@/shared/presentation/primitives';
import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import { useReactFlow } from '@xyflow/react';
import { ZoomIn, ZoomOut, Maximize, Save, AlertTriangle } from 'lucide-react';
import { useCallback } from 'react';

interface CanvasToolbarProps {
    saveStatus: SaveStatus;
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
        <FloatingToolbar placement='bottom' align='center' offset={1.25} className='canvas-toolbar'>
            <SaveStatusIndicator status={saveStatus} className='canvas-toolbar-status' />

            {hasErrors && (
                <Tooltip
                    content={validationResult!.errors.join(' · ')}
                    placement='top'
                >
                    <div className='d-flex items-center gap-05 canvas-toolbar-status canvas-toolbar-status--error cursor-pointer'>
                        <AlertTriangle size={14} />
                        <p className='font-size-2'>
                            {validationResult!.errors.length} {validationResult!.errors.length === 1 ? 'issue' : 'issues'}
                        </p>
                    </div>
                </Tooltip>
            )}

            <div className='d-flex items-center gap-025'>
                <Tooltip content='Zoom out' placement='top'>
                    <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={handleZoomOut}>
                        <ZoomOut size={16} />
                    </Button>
                </Tooltip>
                <p className='text-center u-select-none canvas-toolbar-zoom-label color-secondary font-size-2 tabular-nums'>
                    {zoomPercent}%
                </p>
                <Tooltip content='Zoom in' placement='top'>
                    <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={handleZoomIn}>
                        <ZoomIn size={16} />
                    </Button>
                </Tooltip>
                <hr className='volt-divider volt-divider--vertical canvas-toolbar-divider' />
                <Tooltip content='Fit to view' placement='top'>
                    <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={handleFitView}>
                        <Maximize size={16} />
                    </Button>
                </Tooltip>
            </div>

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
        </FloatingToolbar>
    );
};

export default CanvasToolbar;
