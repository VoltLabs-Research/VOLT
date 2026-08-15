import { useKeyboardShortcutsStore } from '../../store/use-keyboard-shortcuts-store';
import { useScreenshotStore } from '../../store/use-screenshot-store';
import { resetSceneInteraction } from '../../hooks/use-scene-interaction';
import { useEditorStore } from '@/modules/canvas/store/editor';

import { FractalAssetLoader } from '@/modules/fractal/services/asset-loader';
import { useEffect } from 'react';

const useCanvasCleanup = () => {
    useEffect(() => {
        return () => {
            useEditorStore.getState().resetAll();
            useScreenshotStore.getState().reset();
            useKeyboardShortcutsStore.getState().reset();
            resetSceneInteraction();
            FractalAssetLoader.clearCache();
        };
    }, []);
};

export default useCanvasCleanup;
