import { useEditorStore } from '@/modules/canvas/stores/editor';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/tools/types';

type ResetCameraInput = Record<string, never>;

/**
 * Resets the 3D viewer camera and orbit controls to the default framing.
 *
 * Primary path: the mounted FractalScene's imperative `resetCamera()` handle
 * (exposed via the canvas bridge), which recomputes the camera from the live
 * scene bounds. Fallback (and always-run, to keep persisted editor state in
 * sync): the editor store's `camera.reset()` + `orbitControls.reset()`, which
 * are zundo temporal-wrapped so the reset is user-undoable.
 */
const resetCamera: ClientToolHandler<ResetCameraInput> = {
    name: 'reset_camera',
    needsViewer: true,

    run(_input, ctx): ClientToolResult {
        const bridge = ctx.getCanvasBridge();

        ctx.markViewerActing();

        const editor = useEditorStore.getState();
        editor.camera.reset();
        editor.orbitControls.reset();

        const usedImperative = typeof bridge.resetCamera === 'function';
        if (usedImperative) {
            bridge.resetCamera?.();
        }

        return {
            ok: true,
            summary: 'Reset the camera to the default view.',
            data: { usedImperativeHandle: usedImperative }
        };
    },

    describeEffect() {
        return { label: 'Reset the camera', icon: 'camera' };
    }
};

export default resetCamera;
