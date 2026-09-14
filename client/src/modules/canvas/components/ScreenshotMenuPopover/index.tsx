import { useScreenshotStore } from '@/modules/canvas/store/use-screenshot-store';
import { useEditorStore } from '@/modules/canvas/store/editor';
import useFigureBatch from '@/modules/canvas/hooks/use-figure-batch';
import {
    SCREENSHOT_ANGLE_OPTIONS,
    SCREENSHOT_RESOLUTION_OPTIONS,
    clampScreenshotDimension,
    resolveScreenshotSize
} from '@/modules/canvas/utils/screenshot';
import { Button, Switch, cn } from '@heroui/react';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import Scrollable from '@/shared/ui/components/Scrollable';
import { Camera, Image } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import type { ScreenshotSettings } from '@/modules/canvas/utils/screenshot';

interface ScreenshotMenuPanelProps {
    close: () => void;
    trajectoryId?: string;
    figureBatch: ReturnType<typeof useFigureBatch>;
}

const ScreenshotMenuPanel = ({ close, trajectoryId, figureBatch }: ScreenshotMenuPanelProps) => {
    const lastUsedSettings = useScreenshotStore((state) => state.lastUsedSettings);
    const isCapturing = useScreenshotStore((state) => state.isCapturing);
    const [draft, setDraft] = useState<ScreenshotSettings>(lastUsedSettings);
    const [customWidthInput, setCustomWidthInput] = useState(String(lastUsedSettings.customWidth));
    const [customHeightInput, setCustomHeightInput] = useState(String(lastUsedSettings.customHeight));
    const {
        recipe,
        candidates,
        selectedAnalysisIds,
        toggleAnalysis,
        selectAllReady,
        clearSelection,
        runBatch,
        resolveFilename,
        progress,
        isBatching,
        isBusy
    } = figureBatch;
    const activeScenes = useEditorStore((state) => state.activeScenes);

    const resolvedSettings = useMemo<ScreenshotSettings>(() => ({
        ...draft,
        customWidth: clampScreenshotDimension(Number(customWidthInput), lastUsedSettings.customWidth),
        customHeight: clampScreenshotDimension(Number(customHeightInput), lastUsedSettings.customHeight)
    }), [customHeightInput, customWidthInput, draft, lastUsedSettings.customHeight, lastUsedSettings.customWidth]);

    const resolutionCopy = useMemo(() => {
        if (resolvedSettings.resolutionPreset === 'viewport') {
            return 'Matches the current viewport size.';
        }

        const size = resolveScreenshotSize(resolvedSettings, {
            width: resolvedSettings.customWidth,
            height: resolvedSettings.customHeight
        });
        return `${size.width} × ${size.height} PNG export.`;
    }, [resolvedSettings]);

    const readyCandidates = candidates.filter((candidate) => candidate.ready);
    const selectedCount = selectedAnalysisIds.length;

    const handleCapture = () => {
        useScreenshotStore.getState().requestCapture(resolvedSettings, {
            filename: resolveFilename(activeScenes)
        });
        close();
    };

    const handleBatch = () => {
        void runBatch(resolvedSettings);
        close();
    };

    return (
        <div className='flex min-w-[min(21rem,calc(100vw-3rem))] flex-col gap-3'>
            <div className='flex flex-col gap-2'>
                <FormFieldRHF
                    fieldKey='resolutionPreset'
                    fieldType='select'
                    label='Resolution'
                    fieldValue={draft.resolutionPreset}
                    onFieldChange={(_, value) => {
                        setDraft((current) => ({
                            ...current,
                            resolutionPreset: String(value) as ScreenshotSettings['resolutionPreset']
                        }));
                    }}
                    options={SCREENSHOT_RESOLUTION_OPTIONS.map((option) => ({
                        value: option.value,
                        title: option.title
                    }))}
                    variant='canvas'
                />

                {draft.resolutionPreset === 'custom' && (
                    <div className='flex flex-row items-center gap-2 [&>*]:min-w-0 [&>*]:flex-1'>
                        <FormFieldRHF
                            fieldKey='customWidth'
                            fieldType='input'
                            label='Width'
                            fieldValue={customWidthInput}
                            onFieldChange={(_, value) => setCustomWidthInput(String(value))}
                            inputProps={{ inputMode: 'numeric' }}
                            variant='canvas'
                        />
                        <FormFieldRHF
                            fieldKey='customHeight'
                            fieldType='input'
                            label='Height'
                            fieldValue={customHeightInput}
                            onFieldChange={(_, value) => setCustomHeightInput(String(value))}
                            inputProps={{ inputMode: 'numeric' }}
                            variant='canvas'
                        />
                    </div>
                )}

                <FormFieldRHF
                    fieldKey='anglePreset'
                    fieldType='select'
                    label='Angle'
                    fieldValue={draft.anglePreset}
                    onFieldChange={(_, value) => {
                        setDraft((current) => ({
                            ...current,
                            anglePreset: String(value) as ScreenshotSettings['anglePreset']
                        }));
                    }}
                    options={SCREENSHOT_ANGLE_OPTIONS.map((option) => ({
                        value: option.value,
                        title: option.title
                    }))}
                    variant='canvas'
                />
            </div>

            {trajectoryId && candidates.length > 0 && (
                <div className='flex flex-col gap-2 border-t border-border pt-3'>
                    <div className='flex items-center justify-between gap-2'>
                        <p className='text-xs font-medium text-foreground'>
                            Batch figures
                        </p>
                        {readyCandidates.length > 0 && (
                            <button
                                type='button'
                                className='text-2xs text-muted hover:text-foreground'
                                onClick={selectedCount === readyCandidates.length ? clearSelection : selectAllReady}
                            >
                                {selectedCount === readyCandidates.length ? 'Clear' : 'Select ready'}
                            </button>
                        )}
                    </div>
                    {!recipe && (
                        <p className='text-xs text-muted'>
                            Compose the look once in the viewport — layers, opacity, line width. That recipe is copied to every selected analysis.
                        </p>
                    )}
                    {recipe && candidates.length === 0 && (
                        <p className='text-xs text-muted'>
                            No completed analyses on this trajectory yet.
                        </p>
                    )}
                    {recipe && candidates.length > 0 && (
                        <Scrollable className='flex max-h-40 flex-col gap-1 pr-1'>
                            {candidates.map((candidate) => {
                                const checked = selectedAnalysisIds.includes(candidate.analysisId);
                                const disabled = !candidate.ready || isBusy;
                                const labelId = `figure-batch-label-${candidate.analysisId}`;
                                return (
                                    <div
                                        key={candidate.analysisId}
                                        className={cn(
                                            'flex items-start justify-between gap-3 rounded-md px-1.5 py-1 text-xs',
                                            candidate.ready ? 'text-foreground' : 'text-muted'
                                        )}
                                    >
                                        <span className='min-w-0 leading-4'>
                                            <span
                                                id={labelId}
                                                className='block truncate'
                                                title={candidate.label}
                                            >
                                                {candidate.label}
                                            </span>
                                            {!candidate.ready && (
                                                <span className='block text-2xs text-muted'>
                                                    Missing {candidate.missingLayers.join(' and ')}
                                                </span>
                                            )}
                                        </span>
                                        <Switch
                                            size='sm'
                                            isSelected={checked}
                                            isDisabled={disabled}
                                            onChange={(next) => toggleAnalysis(candidate.analysisId, next)}
                                            aria-labelledby={labelId}
                                        >
                                            <Switch.Content>
                                                <Switch.Control>
                                                    <Switch.Thumb />
                                                </Switch.Control>
                                            </Switch.Content>
                                        </Switch>
                                    </div>
                                );
                            })}
                        </Scrollable>
                    )}
                </div>
            )}

            <div className='flex flex-col gap-1 pt-1'>
                <p className='text-xs text-muted'>
                    {resolutionCopy}
                </p>
                <p className='text-xs text-muted'>
                    {isBatching && progress
                        ? `Capturing ${progress.current} of ${progress.total}: ${progress.label}`
                        : 'Ctrl+S captures using the last settings.'}
                </p>
            </div>

            <div className='flex flex-col gap-2'>
                <Button
                    variant='primary'
                    size='sm'
                    fullWidth
                    isPending={isCapturing && !isBatching}
                    isDisabled={isBusy}
                    onPress={handleCapture}
                >
                    {isCapturing && !isBatching ? undefined : <Image size={14} />}
                    {isCapturing && !isBatching ? 'Capturing...' : 'Capture screenshot'}
                </Button>
                {trajectoryId && recipe && (
                    <Button
                        variant='secondary'
                        size='sm'
                        fullWidth
                        isPending={isBatching}
                        isDisabled={isBusy || selectedCount === 0}
                        onPress={handleBatch}
                    >
                        {isBatching
                            ? `Capturing ${progress?.current ?? 0} of ${progress?.total ?? selectedCount}…`
                            : `Capture ${selectedCount || 'selected'} figure${selectedCount === 1 ? '' : 's'}`}
                    </Button>
                )}
            </div>
        </div>
    );
};

const ScreenshotMenuPopover = () => {
    const { trajectoryId } = useParams<{ trajectoryId?: string }>();
    const figureBatch = useFigureBatch({ trajectoryId });

    return (
        <ContextMenuPopover
            id='viewport-screenshot-menu'
            trigger={(
                <Button
                    variant='ghost'
                    size='sm'
                    isIconOnly
                    aria-label='Screenshot settings'
                >
                    <Camera size={14} aria-hidden='true' />
                </Button>
            )}
            content={(close) => (
                <ScreenshotMenuPanel
                    close={close}
                    trajectoryId={trajectoryId}
                    figureBatch={figureBatch}
                />
            )}
            triggerAction='click'
            ariaLabel='Screenshot settings'
            className='min-w-[min(22rem,calc(100vw-2rem))] max-w-[min(26rem,calc(100vw-2rem))]'
        />
    );
};

export default ScreenshotMenuPopover;
