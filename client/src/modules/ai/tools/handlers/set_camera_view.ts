import { useEditorStore } from '@/modules/canvas/stores/editor';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/tools/types';

type CameraView = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'isometric';

interface SetCameraViewInput {
    view?: CameraView;
}

type Vec3 = [number, number, number];

/**
 * Distance from the origin to place the camera. The bridge does not expose live
 * scene bounds, so we use a constant close to the scene's default camera
 * distance (default position is [8,8,6], |.| ~ 12.8). The orbit controls clamp
 * to min/maxDistance, so this stays inside a valid range for typical scenes.
 */
const VIEW_DISTANCE = 12;

const ISO = VIEW_DISTANCE / Math.sqrt(3);

/**
 * Viewpoints in the scene's z-up convention (default camera up is [0,0,1], the
 * standard for LAMMPS/atomistic data). For top/bottom (looking along the up
 * axis) the up vector is swapped to +Y so the view is well-defined. Target is
 * always the scene origin.
 */
const VIEWS: Record<CameraView, { position: Vec3; up: Vec3 }> = {
    front: { position: [0, -VIEW_DISTANCE, 0], up: [0, 0, 1] },
    back: { position: [0, VIEW_DISTANCE, 0], up: [0, 0, 1] },
    right: { position: [VIEW_DISTANCE, 0, 0], up: [0, 0, 1] },
    left: { position: [-VIEW_DISTANCE, 0, 0], up: [0, 0, 1] },
    top: { position: [0, 0, VIEW_DISTANCE], up: [0, 1, 0] },
    bottom: { position: [0, 0, -VIEW_DISTANCE], up: [0, 1, 0] },
    isometric: { position: [ISO, ISO, ISO], up: [0, 0, 1] }
};

const isCameraView = (value: unknown): value is CameraView =>
    typeof value === 'string' && Object.prototype.hasOwnProperty.call(VIEWS, value);

/**
 * Snaps the viewer camera to a named viewpoint by setting the editor store
 * camera position + up vector and re-targeting the orbit controls at the
 * origin. Store mutations are zundo temporal-wrapped, so the change is
 * user-undoable.
 */
const setCameraView: ClientToolHandler<SetCameraViewInput> = {
    name: 'set_camera_view',
    needsViewer: true,

    run(input, ctx): ClientToolResult {
        const view = input.view;

        if (!isCameraView(view)) {
            return {
                ok: false,
                summary: 'Could not change the camera view.',
                reason: 'invalid_view',
                hint: 'view must be one of: front, back, left, right, top, bottom, isometric.'
            };
        }

        const { position, up } = VIEWS[view];

        ctx.markViewerActing();

        const editor = useEditorStore.getState();
        editor.camera.setPosition(position);
        editor.camera.setUp(up);
        editor.orbitControls.setTarget([0, 0, 0]);

        return {
            ok: true,
            summary: `Set the camera to the ${view} view.`,
            data: { view, position, up }
        };
    },

    describeEffect(input, result) {
        if (!result.ok) {
            return { label: 'Camera view unchanged', icon: 'camera' };
        }
        return { label: `Set ${input.view ?? ''} view`.trim(), icon: 'camera' };
    }
};

export default setCameraView;
