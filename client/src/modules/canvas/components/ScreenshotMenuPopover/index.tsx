import { useScreenshotStore } from '@/modules/canvas/stores/use-screenshot-store';
import {
    SCREENSHOT_ANGLE_OPTIONS,
    SCREENSHOT_RESOLUTION_OPTIONS,
    clampScreenshotDimension,
    resolveScreenshotSize
} from '@/modules/canvas/utilities/screenshot';
import Button from '@/shared/presentation/components/Button';
import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { Camera, Image } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { ScreenshotSettings } from '@/modules/canvas/utilities/screenshot';

import './ScreenshotMenuPopover.css';

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
        <div className='volt-container canvas-screenshot-popover d-flex column gap-075'>
            <div className='volt-container canvas-screenshot-popover-fields d-flex column gap-05'>
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
                    <div className='volt-container canvas-screenshot-popover-custom-size d-flex gap-05'>
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

            <div className='volt-container canvas-screenshot-popover-summary d-flex column gap-025'>
                <p className='volt-text font-size-1 color-secondary'>
                    {resolutionCopy}
                </p>
                <p className='volt-text font-size-1 color-muted'>
                    Ctrl+S captures using the last settings.
                </p>
            </div>

            <Button
                variant='solid'
                intent='brand'
                size='sm'
                shape='rounded'
                block
                isLoading={isCapturing}
                leftIcon={isCapturing ? undefined : <Image size={14} />}
                onClick={handleCapture}
            >
                {isCapturing ? 'Capturing...' : 'Capture screenshot'}
            </Button>
        </div>
    );
};

const ScreenshotMenuPopover = () => {
    return (
        <ContextMenuPopover
            id='viewport-screenshot-menu'
            trigger={(
                <Button
                    variant='ghost'
                    intent='canvas'
                    shape='rounded'
                    size='sm'
                    className='font-size-05 canvas-btn-compact'
                    leftIcon={<span className='d-flex items-center content-center f-shrink-0'><Camera size={12} /></span>}
                    aria-label='Screenshot settings'
                    title='Screenshot settings'
                >
                    Screenshot
                </Button>
            )}
            content={(close) => <ScreenshotMenuPanel close={close} />}
            triggerAction='click'
            ariaLabel='Screenshot settings'
            className='context-menu-popover--screenshot-config'
        />
    );
};

export default ScreenshotMenuPopover;
