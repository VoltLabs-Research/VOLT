import { useEditorStore } from '@/modules/canvas/store/editor';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/contracts/tools';

const resetCamera: ClientToolHandler = {
    name: 'reset_camera',
    needsViewer: true,

    run(_input, ctx): ClientToolResult {
        const { resetCamera: resetCameraHandle } = ctx.getCanvasBridge();

        ctx.markViewerActing();

        const editor = useEditorStore.getState();
        editor.camera.reset();
        editor.orbitControls.reset();

        const usedImperative = resetCameraHandle !== null;
        resetCameraHandle?.();

        return {
            ok: true,
            summary: 'Reset the camera to the default view.',
            data: { usedImperativeHandle: usedImperative }
        };
    },

    describeEffect() {
        return {
            label: 'Reset the camera',
            icon: 'camera'
        };
    }
};

export default resetCamera;
