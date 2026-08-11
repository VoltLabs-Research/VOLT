import { useCanvasBridgeStore } from '../../store/use-canvas-bridge-store';
import { useEditorStore } from '@/modules/canvas/store/editor';
import { useEffect } from 'react';

import type { RefObject } from 'react';
import type { FractalSceneRef } from '@/modules/fractal/components/organisms/FractalScene';

interface CanvasBridgeRegistrationParams {
    trajectoryId: string;
    timesteps: number[];
    currentTimestep: number | undefined;
    sceneRef: RefObject<FractalSceneRef | null>;
}

const useCanvasBridgeRegistration = ({
    trajectoryId,
    timesteps,
    currentTimestep,
    sceneRef
}: CanvasBridgeRegistrationParams) => {
    const activeScene = useEditorStore((state) => state.activeScene);
    const register = useCanvasBridgeStore((state) => state.register);
    const unregister = useCanvasBridgeStore((state) => state.unregister);

    useEffect(() => {
        if (!trajectoryId) {
            return;
        }

        register({
            trajectoryId,
            timesteps,
            currentTimestep,
            activeSceneId: activeScene ? `${activeScene.source}:${activeScene.sceneType}` : null,
            sceneRef
        });

        return unregister;
    }, [trajectoryId, timesteps, currentTimestep, activeScene, register, unregister, sceneRef]);
};

export default useCanvasBridgeRegistration;
