import { useEditorStore } from '@/modules/canvas/store/editor';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/contracts/tools';
import type { SetCameraViewInput } from '@volt/contracts/modules/ai/ai-tools';
import type { Vec3 } from '@/shared/contracts/geometry';

const VIEW_DISTANCE = 12;

const ISO = VIEW_DISTANCE / Math.sqrt(3);

interface CameraViewPose {
    position: Vec3;
    up: Vec3;
}

const VIEWS: Record<SetCameraViewInput['view'], CameraViewPose> = {
    front: {
        position: [0, -VIEW_DISTANCE, 0],
        up: [0, 0, 1]
    },
    back: {
        position: [0, VIEW_DISTANCE, 0],
        up: [0, 0, 1]
    },
    right: {
        position: [VIEW_DISTANCE, 0, 0],
        up: [0, 0, 1]
    },
    left: {
        position: [-VIEW_DISTANCE, 0, 0],
        up: [0, 0, 1]
    },
    top: {
        position: [0, 0, VIEW_DISTANCE],
        up: [0, 1, 0]
    },
    bottom: {
        position: [0, 0, -VIEW_DISTANCE],
        up: [0, 1, 0]
    },
    isometric: {
        position: [ISO, ISO, ISO],
        up: [0, 0, 1]
    }
};

const setCameraView: ClientToolHandler<SetCameraViewInput> = {
    name: 'set_camera_view',
    needsViewer: true,

    run(input, ctx): ClientToolResult {
        const { view } = input;
        const { position, up } = VIEWS[view];

        ctx.markViewerActing();

        const editor = useEditorStore.getState();
        editor.camera.setPosition(position);
        editor.camera.setUp(up);
        editor.orbitControls.setTarget([0, 0, 0]);

        return {
            ok: true,
            summary: `Set the camera to the ${view} view.`,
            data: {
                view,
                position,
                up
            }
        };
    },

    describeEffect(input) {
        return {
            label: `Set ${input.view} view`,
            icon: 'camera'
        };
    }
};

export default setCameraView;
