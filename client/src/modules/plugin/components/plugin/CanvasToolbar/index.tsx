import { usePluginBuilderStore } from '@/modules/plugin/stores/plugin/use-plugin-builder-store';
import Button from '@/shared/presentation/components/Button';
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
        <div className='volt-container p-absolute z-10 center-x d-flex items-center gap-05 radius-full canvas-toolbar glass-bg'>
            {saveStatus === 'saving' && (
                <div className='volt-container d-flex items-center gap-05 canvas-toolbar-status'>
                    <div className='volt-container f-shrink-0 radius-full canvas-toolbar-status-dot' />
                    <p className='volt-text font-size-2 color-secondary'>Saving...</p>
                </div>
            )}
            {saveStatus === 'saved' && (
                <div className='volt-container d-flex items-center gap-05 canvas-toolbar-status canvas-toolbar-status--saved'>
                    <Check size={14} />
                    <p className='volt-text font-size-2'>Saved</p>
                </div>
            )}
            {saveStatus === 'error' && (
                <div className='volt-container d-flex items-center gap-05 canvas-toolbar-status canvas-toolbar-status--error'>
                    <AlertTriangle size={14} />
                    <p className='volt-text font-size-2'>Error</p>
                </div>
            )}

            {hasErrors && (
                <Tooltip
                    content={validationResult!.errors.join(' · ')}
                    placement='top'
                >
                    <div className='volt-container d-flex items-center gap-05 canvas-toolbar-status canvas-toolbar-status--error cursor-pointer'>
                        <AlertTriangle size={14} />
                        <p className='volt-text font-size-2'>
                            {validationResult!.errors.length} {validationResult!.errors.length === 1 ? 'issue' : 'issues'}
                        </p>
                    </div>
                </Tooltip>
            )}

            <div className='volt-container d-flex items-center gap-025'>
                <Tooltip content='Zoom out' placement='top'>
                    <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={handleZoomOut}>
                        <ZoomOut size={16} />
                    </Button>
                </Tooltip>
                <p className='volt-text text-center u-select-none canvas-toolbar-zoom-label color-secondary font-size-2'>
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
        </div>
    );
};

export default CanvasToolbar;
