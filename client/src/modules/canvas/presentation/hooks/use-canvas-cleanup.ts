import { useEffect } from 'react';
import { AssetLoader } from '@/modules/fractal/core/AssetLoader';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import useTrajectoryStore from '@/modules/trajectory/presentation/stores/use-trajectory-store';
import { resetSceneInteraction } from './use-scene-interaction';
import { useScreenshotStore } from '../stores/use-screenshot-store';
import { useKeyboardShortcutsStore } from '../stores/use-keyboard-shortcuts-store';

const useCanvasCleanup = () => {
    useEffect(() => {
        return () => {
            useEditorStore.getState().resetAll();
            useTrajectoryStore.getState().setTrajectory(null);
            useScreenshotStore.getState().reset();
            useKeyboardShortcutsStore.getState().reset();
            resetSceneInteraction();
            AssetLoader.clearCache();
        };
    }, []);
};

export default useCanvasCleanup;
