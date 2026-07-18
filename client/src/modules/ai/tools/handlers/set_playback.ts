import { useEditorStore } from '@/modules/canvas/stores/editor';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/tools/types';

interface SetPlaybackInput {
    speed?: number;
    targetFps?: number;
    rangeStart?: number;
    rangeEnd?: number;
}

const MIN_PLAY_SPEED = 0.1;
const MAX_PLAY_SPEED = 10;

const setPlayback: ClientToolHandler<SetPlaybackInput> = {
    name: 'set_playback',
    needsViewer: true,

    run(input, ctx): ClientToolResult {
        const store = useEditorStore.getState();
        const applied: Record<string, number> = {};

        let touched = false;

        if (typeof input.speed === 'number' && Number.isFinite(input.speed)) {
            const clamped = Math.max(MIN_PLAY_SPEED, Math.min(MAX_PLAY_SPEED, input.speed));
            store.setPlaySpeed(clamped);
            applied.speed = clamped;
            touched = true;
        }

        if (typeof input.targetFps === 'number' && Number.isFinite(input.targetFps) && input.targetFps > 0) {
            store.setTargetFps(input.targetFps);
            applied.targetFps = input.targetFps;
            touched = true;
        }

        if (typeof input.rangeStart === 'number' && Number.isFinite(input.rangeStart)) {
            store.setRangeStart(input.rangeStart);
            applied.rangeStart = input.rangeStart;
            touched = true;
        }

        if (typeof input.rangeEnd === 'number' && Number.isFinite(input.rangeEnd)) {
            store.setRangeEnd(input.rangeEnd);
            applied.rangeEnd = input.rangeEnd;
            touched = true;
        }

        if (!touched) {
            return {
                ok: false,
                summary: 'No playback settings were provided.',
                reason: 'no_settings',
                hint: 'Provide at least one of: speed, targetFps, rangeStart, rangeEnd.'
            };
        }

        ctx.markViewerActing();

        const parts = Object.entries(applied).map(([key, value]) => `${key}=${value}`);
        return {
            ok: true,
            summary: `Updated playback settings (${parts.join(', ')}).`,
            data: applied
        };
    },

    describeEffect(_input, result) {
        if (!result.ok) {
            return { label: 'Playback settings unchanged', icon: 'settings' };
        }
        return { label: 'Updated playback settings', icon: 'settings' };
    }
};

export default setPlayback;
