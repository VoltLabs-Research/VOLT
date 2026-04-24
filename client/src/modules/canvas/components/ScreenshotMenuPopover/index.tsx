import { useScreenshotStore } from '@/modules/canvas/stores/use-screenshot-store';
import {
    SCREENSHOT_ANGLE_OPTIONS,
    SCREENSHOT_RESOLUTION_OPTIONS,
    clampScreenshotDimension,
    resolveScreenshotSize
} from '@/modules/canvas/utilities/screenshot';
import Button from '@/shared/presentation/primitives/Button';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import Tooltip from '@/shared/presentation/primitives/Tooltip';
import ContextMenuPopover from '@/shared/presentation/primitives/ContextMenuPopover';
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
        <Stack gap='075' className='canvas-screenshot-popover'>
            <Stack gap='05' className='canvas-screenshot-popover-fields'>
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
                    <Row gap='05' className='canvas-screenshot-popover-custom-size'>
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
                    </Row>
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
            </Stack>

            <Stack gap='025' className='canvas-screenshot-popover-summary'>
                <Text as='p' size='sm' tone='secondary'>
                    {resolutionCopy}
                </Text>
                <Text as='p' size='sm' tone='muted'>
                    Ctrl+S captures using the last settings.
                </Text>
            </Stack>

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
        </Stack>
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
                <span className='d-inline-flex flex-center'>
                    <Tooltip content='Screenshot' placement='bottom'>
                        <Button
                            variant='ghost'
                            intent='canvas'
                            shape='rounded'
                            size='sm'
                            iconOnly
                            className='canvas-viewport-floating-btn'
                            aria-label='Screenshot settings'
                        >
                            <Camera size={14} />
                        </Button>
                    </Tooltip>
                </span>
            ) : (
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
