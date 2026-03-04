import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Download, Lock, Unlock, Image } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import FormField from '@/shared/presentation/components/FormField';
import type { SelectOption } from '@/shared/presentation/components/Select';
import IconButton from '@/shared/presentation/components/IconButton';
import Tooltip from '@/shared/presentation/components/Tooltip';
import {
    useScreenshotStore,
    RESOLUTION_PRESETS,
    type ScreenshotFormat,
    type ScreenshotBackground
} from '../../../stores/use-screenshot-store';
import './ScreenshotModal.css';

export const SCREENSHOT_MODAL_ID = 'volt-screenshot-modal';

const RESOLUTION_OPTIONS: SelectOption[] = RESOLUTION_PRESETS.map((p) => ({
    value: p.label, title: p.label
}));

const FORMAT_OPTIONS: SelectOption[] = [
    { value: 'png', title: 'PNG' },
    { value: 'jpeg', title: 'JPEG' }
];

const BACKGROUND_OPTIONS: SelectOption[] = [
    { value: 'current', title: 'Current' },
    { value: 'transparent', title: 'Transparent' },
    { value: 'custom', title: 'Custom Color' }
];

const SUPERSAMPLING_OPTIONS: SelectOption[] = [
    { value: '1', title: '1x (Standard)' },
    { value: '2', title: '2x (High)' },
    { value: '4', title: '4x (Ultra)' }
];

const ScreenshotModal = () => {
    const {
        settings,
        preview,
        isCapturing,
        viewportSize,
        setSettings,
        requestCapture,
        requestPreview
    } = useScreenshotStore(useShallow((s) => ({
        settings: s.settings,
        preview: s.preview,
        isCapturing: s.isCapturing,
        viewportSize: s.viewportSize,
        setSettings: s.setSettings,
        requestCapture: s.requestCapture,
        requestPreview: s.requestPreview
    })));

    const isCustomResolution = settings.resolutionPreset === 'Custom';
    const isViewportResolution = settings.resolutionPreset === 'Viewport';

    const displayWidth = isViewportResolution ? viewportSize.width : settings.width;
    const displayHeight = isViewportResolution ? viewportSize.height : settings.height;

    const aspectRatio = useMemo(() => {
        if (viewportSize.width > 0 && viewportSize.height > 0) {
            return viewportSize.width / viewportSize.height;
        }
        return 16 / 9;
    }, [viewportSize]);

    const handleResolutionPresetChange = useCallback((_key: string, value: string | number | boolean) => {
        const preset = RESOLUTION_PRESETS.find((p) => p.label === String(value));
        if (!preset) return;
        if (preset.label === 'Viewport') {
            setSettings({ resolutionPreset: preset.label, width: 0, height: 0 });
        } else if (preset.label === 'Custom') {
            setSettings({
                resolutionPreset: preset.label,
                width: viewportSize.width || 1920,
                height: viewportSize.height || 1080
            });
        } else {
            setSettings({ resolutionPreset: preset.label, width: preset.width, height: preset.height });
        }
    }, [setSettings, viewportSize]);

    const handleWidthChange = useCallback((_key: string, value: string | number | boolean) => {
        const w = Math.max(1, parseInt(String(value), 10) || 0);
        if (settings.lockAspectRatio && aspectRatio > 0) {
            setSettings({ width: w, height: Math.round(w / aspectRatio) });
        } else {
            setSettings({ width: w });
        }
    }, [setSettings, settings.lockAspectRatio, aspectRatio]);

    const handleHeightChange = useCallback((_key: string, value: string | number | boolean) => {
        const h = Math.max(1, parseInt(String(value), 10) || 0);
        if (settings.lockAspectRatio && aspectRatio > 0) {
            setSettings({ height: h, width: Math.round(h * aspectRatio) });
        } else {
            setSettings({ height: h });
        }
    }, [setSettings, settings.lockAspectRatio, aspectRatio]);

    const previewTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

    useEffect(() => {
        if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
        previewTimerRef.current = setTimeout(() => {
            requestPreview();
        }, 300);
        return () => {
            if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
        };
    }, [settings, requestPreview]);

    const handleCaptureAndClose = useCallback(() => {
        requestCapture();
        closeModal(SCREENSHOT_MODAL_ID);
    }, [requestCapture]);

    return (
        <Modal
            id={SCREENSHOT_MODAL_ID}
            title="Screenshot"
            description="Capture the viewport for publications and presentations."
            width="480px"
            footer={
                <Container className="d-flex items-center content-between w-max">
                    <Container className="d-flex items-center gap-025 screenshot-modal-resolution-hint">
                        <Image size={12} />
                        <span className="font-size-1 color-muted">
                            {displayWidth || '?'} x {displayHeight || '?'} px
                        </span>
                    </Container>
                    <Container className="d-flex items-center gap-05">
                        <Button
                            variant="solid"
                            intent="brand"
                            size="sm"
                            onClick={handleCaptureAndClose}
                            isLoading={isCapturing}
                            leftIcon={<Download size={14} />}
                        >
                            Capture
                        </Button>
                    </Container>
                </Container>
            }
        >
            <Container className="screenshot-modal-content d-flex column">
                <Container className="screenshot-modal-preview">
                    {preview && (
                        <img
                            src={preview}
                            alt="Screenshot preview"
                            className="screenshot-modal-preview-img"
                        />
                    )}
                </Container>

                <Container className="screenshot-modal-section d-flex column gap-05">
                    <span className="screenshot-modal-section-title font-size-1 color-muted font-weight-6">RESOLUTION</span>
                    <Container className="d-flex column gap-05">
                        <FormField
                            variant="canvas"
                            label="Preset"
                            fieldType="select"
                            fieldKey="resolutionPreset"
                            fieldValue={settings.resolutionPreset}
                            onFieldChange={handleResolutionPresetChange}
                            options={RESOLUTION_OPTIONS}
                        />
                        {isCustomResolution && (
                            <Container className="d-flex items-center gap-05">
                                <FormField
                                    variant="canvas"
                                    label="Width"
                                    fieldType="input"
                                    fieldKey="width"
                                    fieldValue={settings.width}
                                    onFieldChange={handleWidthChange}
                                    inputProps={{ type: 'number', min: 1, max: 7680 }}
                                    placeholder="1920"
                                />
                                <Tooltip content={settings.lockAspectRatio ? 'Unlock aspect ratio' : 'Lock aspect ratio'}>
                                    <IconButton
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSettings({ lockAspectRatio: !settings.lockAspectRatio })}
                                        className="screenshot-modal-lock-btn"
                                    >
                                        {settings.lockAspectRatio ? <Lock size={12} /> : <Unlock size={12} />}
                                    </IconButton>
                                </Tooltip>
                                <FormField
                                    variant="canvas"
                                    label="Height"
                                    fieldType="input"
                                    fieldKey="height"
                                    fieldValue={settings.height}
                                    onFieldChange={handleHeightChange}
                                    inputProps={{ type: 'number', min: 1, max: 4320 }}
                                    placeholder="1080"
                                />
                            </Container>
                        )}
                    </Container>
                </Container>

                <Container className="screenshot-modal-section d-flex column gap-05">
                    <span className="screenshot-modal-section-title font-size-1 color-muted font-weight-6">OUTPUT</span>
                    <Container className="d-flex column gap-05">
                        <FormField
                            variant="canvas"
                            label="Format"
                            fieldType="select"
                            fieldKey="format"
                            fieldValue={settings.format}
                            onFieldChange={(_k, v) => setSettings({ format: String(v) as ScreenshotFormat })}
                            options={FORMAT_OPTIONS}
                        />
                        {settings.format === 'jpeg' && (
                            <FormField
                                variant="canvas"
                                label="Quality"
                                fieldType="input"
                                fieldKey="jpegQuality"
                                fieldValue={settings.jpegQuality}
                                onFieldChange={(_k, v) => setSettings({ jpegQuality: Math.min(1, Math.max(0.1, parseFloat(String(v)) || 0.92)) })}
                                inputProps={{ type: 'number', min: 0.1, max: 1, step: 0.05 }}
                            />
                        )}
                        <FormField
                            variant="canvas"
                            label="Background"
                            fieldType="select"
                            fieldKey="background"
                            fieldValue={settings.background}
                            onFieldChange={(_k, v) => setSettings({ background: String(v) as ScreenshotBackground })}
                            options={BACKGROUND_OPTIONS}
                        />
                        {settings.background === 'custom' && (
                            <FormField
                                variant="canvas"
                                label="Color"
                                fieldType="color"
                                fieldKey="customBackgroundColor"
                                fieldValue={settings.customBackgroundColor}
                                onFieldChange={(_k, v) => setSettings({ customBackgroundColor: String(v) })}
                            />
                        )}
                    </Container>
                </Container>

                <Container className="screenshot-modal-section d-flex column gap-05">
                    <span className="screenshot-modal-section-title font-size-1 color-muted font-weight-6">QUALITY</span>
                    <FormField
                        variant="canvas"
                        label="Supersampling"
                        fieldType="select"
                        fieldKey="supersamplingFactor"
                        fieldValue={String(settings.supersamplingFactor)}
                        onFieldChange={(_k, v) => setSettings({ supersamplingFactor: parseInt(String(v), 10) || 1 })}
                        options={SUPERSAMPLING_OPTIONS}
                    />
                </Container>
            </Container>
        </Modal>
    );
};

export default ScreenshotModal;
