import PresetPopover from './PresetPopover';

import { ZoomIn } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import type { FractalSceneRef } from '@/modules/fractal/contracts/scene-ref';

const SCENE_ZOOM_SUBSCRIBE_RETRY_MS = 120;
const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200, 400];
const ZOOM_ICON = <ZoomIn size={12} />;

interface ZoomPresetPopoverProps {
    sceneRef: React.RefObject<FractalSceneRef | null>;
}

// Owns the zoom readout so a wheel zoom re-renders this button alone, not the whole timeline.
const ZoomPresetPopover = ({ sceneRef }: ZoomPresetPopoverProps) => {
    const [zoomPercent, setZoomPercent] = useState(100);

    useEffect(() => {
        let cancelled = false;
        let unsubscribe: (() => void) | undefined;
        let retryTimeoutId: number | undefined;

        const trySubscribe = () => {
            if (cancelled) return;
            const scene = sceneRef.current;
            if (scene) {
                unsubscribe = scene.subscribeZoom(setZoomPercent);
                return;
            }
            retryTimeoutId = window.setTimeout(trySubscribe, SCENE_ZOOM_SUBSCRIBE_RETRY_MS);
        };

        trySubscribe();

        return () => {
            cancelled = true;
            if (retryTimeoutId !== undefined) window.clearTimeout(retryTimeoutId);
            unsubscribe?.();
        };
    }, [sceneRef]);

    const zoomTo = useCallback((preset: number) => sceneRef.current?.zoomTo(preset), [sceneRef]);

    return (
        <PresetPopover
            id='timeline-zoom'
            icon={ZOOM_ICON}
            presets={ZOOM_PRESETS}
            value={zoomPercent}
            suffix='%'
            onSelect={zoomTo}
            hideOnMobile
        />
    );
};

export default memo(ZoomPresetPopover);
