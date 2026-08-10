import { useScreenshotStore } from '@/modules/canvas/store/use-screenshot-store';
import {
    SCREENSHOT_ANGLE_OPTIONS,
    SCREENSHOT_RESOLUTION_OPTIONS,
    clampScreenshotDimension,
    resolveScreenshotSize
} from '@/modules/canvas/utils/screenshot';
import { Button, Tooltip } from '@heroui/react';
import { VIEWPORT_FLOATING_BUTTON_CLASS } from '../ViewportFloatingControls/floating-button';
import ContextMenuPopover from '@/shared/ui/components/ContextMenuPopover';
import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import { Camera, Image } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { ScreenshotSettings } from '@/modules/canvas/utils/screenshot';

const ScreenshotMenuPanel = ({ close }: { close: () => void }) => {
    const lastUsedSettings = useScreenshotStore((state) => state.lastUsedSettings);
    const isCapturing = useScreenshotStore((state) => state.isCapturing);
    const [draft, setDraft] = useState<ScreenshotSettings>(lastUsedSettings);
    const [customWidthInput, setCustomWidthInput] = useState(String(lastUsedSettings.customWidth));
    const [customHeightInput, setCustomHeightInput] = useState(String(lastUsedSettings.customHeight));

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

    const handleCapture = () => {
        useScreenshotStore.getState().requestCapture(resolvedSettings);
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

            <div className='flex flex-col gap-1 pt-1'>
                <p className='text-xs text-muted'>
                    {resolutionCopy}
                </p>
                <p className='text-xs text-muted'>
                    Ctrl+S captures using the last settings.
                </p>
            </div>

            <Button
                variant='primary'
                size='sm'
                fullWidth
                isPending={isCapturing}
                onPress={handleCapture}
            >
                {isCapturing ? undefined : <Image size={14} />}
                {isCapturing ? 'Capturing...' : 'Capture screenshot'}
            </Button>
        </div>
    );
};

interface ScreenshotMenuPopoverProps {
    compact?: boolean;
}

const ScreenshotMenuPopover = ({ compact = false }: ScreenshotMenuPopoverProps) => {
    return (
        <ContextMenuPopover
            id='viewport-screenshot-menu'
            trigger={compact ? (
                <span className='inline-flex items-center justify-center'>
                    <Tooltip>
                        <Button
                            variant='ghost'
                            size='sm'
                            isIconOnly
                            className={VIEWPORT_FLOATING_BUTTON_CLASS}
                            aria-label='Screenshot settings'
                        >
                            <Camera size={14} />
                        </Button>
                        <Tooltip.Content placement='bottom'>Screenshot</Tooltip.Content>
                    </Tooltip>
                </span>
            ) : (
                <Tooltip>
                    <Button variant='ghost' size='sm' className='text-xs' aria-label='Screenshot settings'>
                        <Camera size={12} className='shrink-0' />
                        Screenshot
                    </Button>
                    <Tooltip.Content placement='bottom'>Screenshot settings</Tooltip.Content>
                </Tooltip>
            )}
            content={(close) => <ScreenshotMenuPanel close={close} />}
            triggerAction='click'
            ariaLabel='Screenshot settings'
            className='min-w-[min(22rem,calc(100vw-2rem))] max-w-[min(24rem,calc(100vw-2rem))]'
        />
    );
};

export default ScreenshotMenuPopover;
