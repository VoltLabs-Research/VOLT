import Loader from '@/shared/ui/components/Loader';
import { Alert, Button, Separator, Tooltip, cn } from '@heroui/react';
import type { SaveStatus } from '@/modules/plugin/hooks/plugin/use-workflow-save-status';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import { useReactFlow } from '@xyflow/react';
import { Check, ZoomIn, ZoomOut, Maximize, Save, AlertCircle, AlertTriangle } from 'lucide-react';

interface CanvasToolbarProps {
    saveStatus: SaveStatus;
    onSave: () => void;
    zoom: number;
}

const SaveStatusIndicator = ({ status, className }: { status: SaveStatus; className?: string }) => {
    if (status === 'idle') {
        return null;
    }

    return (
        <div
            role='status'
            aria-live='polite'
            aria-atomic='true'
            className={cn(
                'flex flex-row items-center gap-1 text-xs',
                status === 'error' ? 'text-danger-soft-foreground' : 'text-muted',
                className
            )}
        >
            {status === 'saving' && <Loader size='sm' color='current' />}
            {status === 'saved' && <Check size={12} aria-hidden='true' />}
            {status === 'error' && <AlertCircle size={12} aria-hidden='true' />}

            <span>
                {status === 'saving' && 'Saving…'}
                {status === 'saved' && 'Saved'}
                {status === 'error' && 'Save failed'}
            </span>
        </div>
    );
};

const CanvasToolbar = ({ saveStatus, onSave, zoom }: CanvasToolbarProps) => {
    const { zoomIn, zoomOut, fitView } = useReactFlow();
    const errors = usePluginBuilderStore((state) => state.validationErrors);

    const issueSummary = `${errors.length} ${errors.length === 1 ? 'issue' : 'issues'}`;
    const validationTitle = `${issueSummary} to fix before publishing`;

    return (
        <>
            {errors.length > 0 && (

                <Alert
                    status='danger'
                    role='alert'
                    aria-live='polite'
                    aria-label={validationTitle}
                    className='glass-surface absolute bottom-18 left-1/2 z-10 w-max max-w-[min(420px,calc(100vw-2rem))] -translate-x-1/2 flex-row items-start justify-between rounded-3xl border-0 bg-[color-mix(in_oklab,var(--danger)_14%,var(--overlay))] px-5 py-3.5 text-danger-soft-foreground shadow-[var(--overlay-shadow)]'
                >
                    <Alert.Content className='gap-1'>
                        <Alert.Title<'h2'> render={(props) => <h2 {...props} />} className='text-base font-semibold text-danger-soft-foreground'>
                            {validationTitle}
                        </Alert.Title>
                        <ul className='m-0 flex list-disc flex-col gap-1 pl-4'>
                            {errors.map((error, index) => (
                                <li className='text-xs' key={index}>
                                    {error}
                                </li>
                            ))}
                        </ul>
                    </Alert.Content>
                </Alert>
            )}

            <div role='toolbar' aria-label='Canvas' className='glass-surface absolute bottom-4 left-1/2 z-10 inline-flex -translate-x-1/2 flex-row items-center gap-1 whitespace-nowrap rounded-full bg-dashboard-surface px-1.5 py-1 shadow-[var(--overlay-shadow)] max-[768px]:bottom-3 max-[768px]:left-2 max-[768px]:right-2 max-[768px]:max-w-[calc(100vw-1rem)] max-[768px]:translate-x-0 max-[768px]:flex-wrap max-[768px]:justify-center'>
                <SaveStatusIndicator status={saveStatus} className='whitespace-nowrap px-2' />

                {errors.length > 0 && (
                    <Tooltip>
                        <Tooltip.Trigger
                            className='flex h-8 cursor-pointer flex-row items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-danger-soft-foreground transition-colors duration-150 hover:bg-danger-soft'
                        >
                            <AlertTriangle size={14} aria-hidden='true' />
                            <p className='text-xs'>
                                {issueSummary}
                            </p>
                        </Tooltip.Trigger>
                        <Tooltip.Content placement='top'>{errors.join(' · ')}</Tooltip.Content>
                    </Tooltip>
                )}

                <div className='flex flex-row items-center gap-1'>
                    <Tooltip>
                        <Button variant='ghost' isIconOnly size='sm' aria-label='Zoom out' onPress={() => zoomOut()}>
                            <ZoomOut size={16} aria-hidden='true' />
                        </Button>
                        <Tooltip.Content placement='top'>Zoom out</Tooltip.Content>
                    </Tooltip>
                    <p className='min-w-11 select-none text-center text-xs tabular-nums text-muted'>
                        {Math.round(zoom * 100)}%
                    </p>
                    <Tooltip>
                        <Button variant='ghost' isIconOnly size='sm' aria-label='Zoom in' onPress={() => zoomIn()}>
                            <ZoomIn size={16} aria-hidden='true' />
                        </Button>
                        <Tooltip.Content placement='top'>Zoom in</Tooltip.Content>
                    </Tooltip>
                    <Separator orientation='vertical' className='mx-1 h-5 bg-foreground/10 max-[768px]:hidden' />
                    <Tooltip>
                        <Button variant='ghost' isIconOnly size='sm' aria-label='Fit to view' onPress={() => fitView({ padding: 0.2 })}>
                            <Maximize size={16} aria-hidden='true' />
                        </Button>
                        <Tooltip.Content placement='top'>Fit to view</Tooltip.Content>
                    </Tooltip>
                </div>
                <Tooltip>
                    <Button
                        variant='ghost'
                        isIconOnly
                        size='sm'
                        aria-label='Save (Ctrl+S)'
                        onPress={onSave}
                        isDisabled={saveStatus === 'saving'}
                    >
                        <Save size={16} aria-hidden='true' />
                    </Button>
                    <Tooltip.Content placement='top'>Save (Ctrl+S)</Tooltip.Content>
                </Tooltip>
            </div>
        </>
    );
};

export default CanvasToolbar;
