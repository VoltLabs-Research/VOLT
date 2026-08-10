import { Alert, Button, Separator, Spinner, Tooltip, cn } from '@heroui/react';
import {
    CALLOUT_DANGER_CLASS,
    CANVAS_TOOLBAR_CLASS,
    CANVAS_TOOLBAR_DIVIDER_CLASS,
    CANVAS_TOOLBAR_STATUS_CLASS,
    CANVAS_TOOLBAR_STATUS_ERROR_CLASS,
    CANVAS_TOOLBAR_VALIDATION_CLASS,
    CANVAS_TOOLBAR_VALIDATION_LIST_CLASS,
    CANVAS_TOOLBAR_ZOOM_LABEL_CLASS
} from '@/modules/plugin/components/plugin/PluginBuilder/builder-styles';
import type { SaveStatus } from '@/modules/plugin/hooks/plugin/use-workflow-save-status';
import { usePluginBuilderStore } from '@/modules/plugin/store/plugin/use-plugin-builder-store';
import { useReactFlow } from '@xyflow/react';
import { Check, ZoomIn, ZoomOut, Maximize, Save, AlertCircle, AlertTriangle } from 'lucide-react';

interface CanvasToolbarProps {
    saveStatus: SaveStatus;
    onSave: () => void;
    zoom: number;
}

/**
 * bravais's `SaveStatusIndicator`, which had no stylesheet of its own — it was a
 * `Row` of an icon and a `Text`, so it converts entirely to utilities. `hideIdle`
 * defaulted to `true` and this call site never overrode it, so `idle` still renders
 * nothing at all.
 *
 * Both of its greys (`tone='muted'` for saved, `tone='secondary'` for saving) land on
 * `text-muted` under §3a, so the distinction goes away — it was ~2% lightness.
 */
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
                status === 'error' ? 'text-danger' : null,
                className
            )}
        >
            {status === 'saving' && <Spinner size='sm' color='current' />}
            {status === 'saved' && <Check size={12} aria-hidden='true' />}
            {status === 'error' && <AlertCircle size={12} aria-hidden='true' />}

            <span className={cn('text-xs', status === 'error' ? null : 'text-muted')}>
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
                /*
                 * `role='alert'` / `aria-live` / `aria-label` are the three bravais
                 * derived for a Callout that has a title. Its `icon` prop is NOT
                 * rendered here, and was not before either: bravais only drew the icon
                 * in its *inline* layout, and a `title` switched it to `stacked`.
                 */
                <Alert
                    status='danger'
                    role='alert'
                    aria-live='polite'
                    aria-label={validationTitle}
                    className={cn(CANVAS_TOOLBAR_VALIDATION_CLASS, CALLOUT_DANGER_CLASS, 'items-start')}
                >
                    <Alert.Content className='gap-1'>
                        <Alert.Title<'h2'> render={(props) => <h2 {...props} />} className='text-sm font-semibold'>
                            {validationTitle}
                        </Alert.Title>

                        <ul className={CANVAS_TOOLBAR_VALIDATION_LIST_CLASS}>
                            {errors.map((error, index) => (
                                <li className='text-xs' key={index}>
                                    {error}
                                </li>
                            ))}
                        </ul>
                    </Alert.Content>
                </Alert>
            )}

            <div role='toolbar' aria-label='Canvas' className={CANVAS_TOOLBAR_CLASS}>
                <SaveStatusIndicator status={saveStatus} className={CANVAS_TOOLBAR_STATUS_CLASS} />

                {errors.length > 0 && (
                    <Tooltip>
                        <Tooltip.Trigger
                            className={cn(
                                'flex cursor-pointer flex-row items-center gap-2',
                                CANVAS_TOOLBAR_STATUS_CLASS,
                                CANVAS_TOOLBAR_STATUS_ERROR_CLASS
                            )}
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
                    <p className={CANVAS_TOOLBAR_ZOOM_LABEL_CLASS}>
                        {Math.round(zoom * 100)}%
                    </p>
                    <Tooltip>
                        <Button variant='ghost' isIconOnly size='sm' aria-label='Zoom in' onPress={() => zoomIn()}>
                            <ZoomIn size={16} aria-hidden='true' />
                        </Button>
                        <Tooltip.Content placement='top'>Zoom in</Tooltip.Content>
                    </Tooltip>
                    <Separator orientation='vertical' className={CANVAS_TOOLBAR_DIVIDER_CLASS} />
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
