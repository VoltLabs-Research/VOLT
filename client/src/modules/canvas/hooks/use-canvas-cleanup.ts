import { useKeyboardShortcutsStore } from '../stores/use-keyboard-shortcuts-store';
import { useScreenshotStore } from '../stores/use-screenshot-store';
import { resetSceneInteraction } from './use-scene-interaction';
import { useEditorStore } from '@/modules/canvas/stores/editor';

import { FractalAssetLoader } from '@/modules/fractal/api/service/asset-loader';
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
