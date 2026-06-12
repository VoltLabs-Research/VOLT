import { useEditorStore } from '@/modules/canvas/stores/editor';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/tools/types';

interface ControlPlaybackInput {
    action?: 'play' | 'pause' | 'stop';
}

/**
 * Starts, pauses, or stops trajectory playback in the 3D viewer.
 *
 * `play` calls `togglePlay` (which only starts when not already playing) using
 * the live trajectory id + timesteps from the canvas bridge. `pause`/`stop`
 * both call `stopPlayback`, which ends the playback loop in place. All changes
 * flow through the zundo-wrapped editor store, so they are user-undoable.
 */
const controlPlayback: ClientToolHandler<ControlPlaybackInput> = {
    name: 'control_playback',
    needsViewer: true,

    run(input, ctx): ClientToolResult {
        const action = input.action;
        if (action !== 'play' && action !== 'pause' && action !== 'stop') {
            return {
                ok: false,
                summary: 'No valid playback action was given.',
                reason: 'invalid_action',
                hint: 'Provide action as one of: "play", "pause", "stop".'
            };
        }

        const bridge = ctx.getCanvasBridge();
        const store = useEditorStore.getState();

        if (action === 'play') {
            if (store.isPlaying) {
                return { ok: true, summary: 'Playback is already running.', data: { action, isPlaying: true } };
            }

            const { trajectoryId, timesteps } = bridge;
            if (!trajectoryId || !Array.isArray(timesteps) || timesteps.length === 0) {
                return {
                    ok: false,
                    summary: 'Cannot start playback — no trajectory frames are loaded.',
                    reason: 'no_trajectory',
                    hint: 'Open a trajectory with timesteps in the viewer first.'
                };
            }

            ctx.markViewerActing();
            store.togglePlay({ trajectoryId, timesteps });
            return { ok: true, summary: 'Started trajectory playback.', data: { action, isPlaying: true } };
        }

        ctx.markViewerActing();
        store.stopPlayback();
        return {
            ok: true,
            summary: action === 'pause' ? 'Paused trajectory playback.' : 'Stopped trajectory playback.',
            data: { action, isPlaying: false }
        };
    },

    describeEffect(input, result) {
        if (!result.ok) {
            return { label: 'Playback control failed', icon: 'play' };
        }
        const action = input.action;
        if (action === 'play') return { label: 'Started playback', icon: 'play' };
        if (action === 'pause') return { label: 'Paused playback', icon: 'pause' };
        return { label: 'Stopped playback', icon: 'stop' };
    }
};

export default controlPlayback;
