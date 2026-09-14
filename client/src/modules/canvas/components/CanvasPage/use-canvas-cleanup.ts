import { useKeyboardShortcutsStore } from '../../store/use-keyboard-shortcuts-store';
import { useScreenshotStore } from '../../store/use-screenshot-store';
import { abortFigureBatch } from '../../hooks/use-figure-batch';
import { resetSceneInteraction } from '../../hooks/use-scene-interaction';
import { useEditorStore } from '@/modules/canvas/store/editor';

import { FractalAssetLoader } from '@/modules/fractal/services/asset-loader';
import { useEffect } from 'react';

const useCanvasCleanup = () => {
    useEffect(() => {
        return () => {
            abortFigureBatch();
            useEditorStore.getState().resetAll();
            useScreenshotStore.getState().reset();
            useKeyboardShortcutsStore.getState().reset();
            resetSceneInteraction();
            FractalAssetLoader.clearCache();
        };
    }, []);
};

export default useCanvasCleanup;
