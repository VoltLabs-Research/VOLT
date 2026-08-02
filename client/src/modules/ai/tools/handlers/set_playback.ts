import { useEditorStore } from '@/modules/canvas/store/editor';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/contracts/tools';
import type { SetPlaybackInput } from '@volt/contracts/modules/ai/ai-tools';

const setPlayback: ClientToolHandler<SetPlaybackInput> = {
    name: 'set_playback',
    needsViewer: true,

    run(input, ctx): ClientToolResult {
        const store = useEditorStore.getState();
        const applied: Record<string, number> = {};

        if (input.speed !== undefined) {
            store.setPlaySpeed(input.speed);
            applied.speed = input.speed;
        }

        // The only bound the contract does not tag, and a zero would stall the clock.
        if (input.targetFps !== undefined && input.targetFps > 0) {
            store.setTargetFps(input.targetFps);
            applied.targetFps = input.targetFps;
        }

        if (input.rangeStart !== undefined) {
            store.setRangeStart(input.rangeStart);
            applied.rangeStart = input.rangeStart;
        }

        if (input.rangeEnd !== undefined) {
            store.setRangeEnd(input.rangeEnd);
            applied.rangeEnd = input.rangeEnd;
        }

        const parts = Object.entries(applied).map(([key, value]) => `${key}=${value}`);

        if (parts.length === 0) {
            return {
                ok: false,
                summary: 'No playback settings were provided.',
                reason: 'no_settings',
                hint: 'Provide at least one of: speed, targetFps, rangeStart, rangeEnd.'
            };
        }

        ctx.markViewerActing();

        return {
            ok: true,
            summary: `Updated playback settings (${parts.join(', ')}).`,
            data: applied
        };
    },

    describeEffect(_input, result) {
        if (!result.ok) {
            return {
                label: 'Playback settings unchanged',
                icon: 'settings'
            };
        }
        return {
            label: 'Updated playback settings',
            icon: 'settings'
        };
    }
};

export default setPlayback;
