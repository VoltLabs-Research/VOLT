import { useEditorStore } from '@/modules/canvas/store/editor';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/contracts/tools';
import type { ControlPlaybackInput } from '@volt/contracts/modules/ai/ai-tools';

const controlPlayback: ClientToolHandler<ControlPlaybackInput> = {
    name: 'control_playback',
    needsViewer: true,

    run(input, ctx): ClientToolResult {
        const { action } = input;
        const store = useEditorStore.getState();

        if (action === 'play') {
            if (store.isPlaying) {
                return {
                    ok: true,
                    summary: 'Playback is already running.',
                    data: {
                        action,
                        isPlaying: true
                    }
                };
            }

            const { trajectoryId, timesteps } = ctx.getCanvasBridge();
            if (!trajectoryId || timesteps.length === 0) {
                return {
                    ok: false,
                    summary: 'Cannot start playback — no trajectory frames are loaded.',
                    reason: 'no_trajectory',
                    hint: 'Open a trajectory with timesteps in the viewer first.'
                };
            }

            ctx.markViewerActing();
            store.togglePlay({
                trajectoryId,
                timesteps
            });
            return {
                ok: true,
                summary: 'Started trajectory playback.',
                data: {
                    action,
                    isPlaying: true
                }
            };
        }

        ctx.markViewerActing();
        store.stopPlayback();
        return {
            ok: true,
            summary: action === 'pause' ? 'Paused trajectory playback.' : 'Stopped trajectory playback.',
            data: {
                action,
                isPlaying: false
            }
        };
    },

    describeEffect(input, result) {
        if (!result.ok) {
            return {
                label: 'Playback control failed',
                icon: 'play'
            };
        }
        if (input.action === 'play') return {
            label: 'Started playback',
            icon: 'play'
        };
        if (input.action === 'pause') return {
            label: 'Paused playback',
            icon: 'pause'
        };
        return {
            label: 'Stopped playback',
            icon: 'stop'
        };
    }
};

export default controlPlayback;
