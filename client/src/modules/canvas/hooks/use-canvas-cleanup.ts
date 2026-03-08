import { useEffect } from 'react';
import { FractalAssetLoader } from '@/modules/fractal/services/asset-loader';
import { useEditorStore } from '@/modules/canvas/stores/editor';
import { resetSceneInteraction } from './use-scene-interaction';
import { useScreenshotStore } from '../stores/use-screenshot-store';
import { useKeyboardShortcutsStore } from '../stores/use-keyboard-shortcuts-store';

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
