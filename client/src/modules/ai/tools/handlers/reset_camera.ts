import { useEditorStore } from '@/modules/canvas/stores/editor';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/tools/types';

type ResetCameraInput = Record<string, never>;

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
