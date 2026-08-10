import { Button, Callout, Divider, FloatingToolbar, SaveStatusIndicator, Tooltip } from '@voltstack/bravais';
import type { SaveStatus } from '@voltstack/bravais';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import { useReactFlow } from '@xyflow/react';
import { ZoomIn, ZoomOut, Maximize, Save, AlertTriangle } from 'lucide-react';

interface CanvasToolbarProps {
    saveStatus: SaveStatus;
    onSave: () => void;
    zoom: number;
}

const CanvasToolbar = ({ saveStatus, onSave, zoom }: CanvasToolbarProps) => {
    const { zoomIn, zoomOut, fitView } = useReactFlow();
    const errors = usePluginBuilderStore((state) => state.validationErrors);

    const issueSummary = `${errors.length} ${errors.length === 1 ? 'issue' : 'issues'}`;

    return (
        <>
            {errors.length > 0 && (
                <Callout
                    tone='danger'
                    title={`${issueSummary} to fix before publishing`}
                    icon={<AlertTriangle size={14} />}
                    role='alert'
                    ariaLive='polite'
                    className='canvas-toolbar-validation'
                >
                    <ul className='flex flex-col gap-1 canvas-toolbar-validation-list'>
                        {errors.map((error, index) => (
                            <li className='text-xs' key={index}>
                                {error}
                            </li>
                        ))}
                    </ul>
                </Callout>
            )}

            <FloatingToolbar placement='bottom' align='center' offset={1.25} className='canvas-toolbar'>
                <SaveStatusIndicator status={saveStatus} className='canvas-toolbar-status' />

                {errors.length > 0 && (
                    <Tooltip
                        content={errors.join(' · ')}
                        placement='top'
                    >
                        <div className='flex flex-row items-center gap-2 cursor-pointer canvas-toolbar-status canvas-toolbar-status--error'>
                            <AlertTriangle size={14} />
                            <p className='text-xs'>
                                {issueSummary}
                            </p>
                        </div>
                    </Tooltip>
                )}

                <div className='flex flex-row items-center gap-1'>
                    <Tooltip content='Zoom out' placement='top'>
                        <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={() => zoomOut()}>
                            <ZoomOut size={16} />
                        </Button>
                    </Tooltip>
                    <p className='text-xs text-muted text-center select-none canvas-toolbar-zoom-label tabular-nums'>
                        {Math.round(zoom * 100)}%
                    </p>
                    <Tooltip content='Zoom in' placement='top'>
                        <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={() => zoomIn()}>
                            <ZoomIn size={16} />
                        </Button>
                    </Tooltip>
                    <Divider orientation='vertical' className='canvas-toolbar-divider' />
                    <Tooltip content='Fit to view' placement='top'>
                        <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={() => fitView({ padding: 0.2 })}>
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
        </>
    );
};

export default CanvasToolbar;
