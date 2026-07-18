import { useEditorStore } from '@/modules/canvas/stores/editor';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/tools/types';

interface SeekFrameInput {
    frame?: number;
    position?: 'first' | 'last' | 'next' | 'previous';
}

const seekFrame: ClientToolHandler<SeekFrameInput> = {
    name: 'seek_frame',
    needsViewer: true,

    run(input, ctx): ClientToolResult {
        const bridge = ctx.getCanvasBridge();
        const timesteps = Array.isArray(bridge.timesteps) ? bridge.timesteps : [];

        if (timesteps.length === 0) {
            return {
                ok: false,
                summary: 'Cannot seek — no trajectory frames are loaded.',
                reason: 'no_trajectory',
                hint: 'Open a trajectory with timesteps in the viewer first.'
            };
        }

        let target: number | undefined;

        if (typeof input.frame === 'number' && Number.isFinite(input.frame)) {
            if (timesteps.includes(input.frame)) {
                target = input.frame;
            } else {
                target = timesteps.reduce((closest, t) =>
                    Math.abs(t - input.frame!) < Math.abs(closest - input.frame!) ? t : closest, timesteps[0]);
            }
        } else if (input.position) {
            const current = bridge.currentTimestep;
            const currentIndex = typeof current === 'number' ? timesteps.indexOf(current) : -1;

            switch (input.position) {
                case 'first':
                    target = timesteps[0];
                    break;
                case 'last':
                    target = timesteps[timesteps.length - 1];
                    break;
                case 'next': {
                    const base = currentIndex === -1 ? 0 : currentIndex;
                    target = timesteps[Math.min(base + 1, timesteps.length - 1)];
                    break;
                }
                case 'previous': {
                    const base = currentIndex === -1 ? 0 : currentIndex;
                    target = timesteps[Math.max(base - 1, 0)];
                    break;
                }
            }
        }

        if (typeof target !== 'number') {
            return {
                ok: false,
                summary: 'No frame target was given.',
                reason: 'invalid_target',
                hint: 'Provide `frame` (a timestep value) or `position` (first/last/next/previous).'
            };
        }

        ctx.markViewerActing();
        useEditorStore.getState().setCurrentTimestep(target);

        return {
            ok: true,
            summary: `Jumped to frame ${target}.`,
            data: { timestep: target, index: timesteps.indexOf(target), totalFrames: timesteps.length }
        };
    },

    describeEffect(_input, result) {
        if (!result.ok) {
            return { label: 'Seek failed', icon: 'seek' };
        }
        const timestep = (result.data as { timestep?: number } | undefined)?.timestep;
        return { label: timestep !== undefined ? `Jumped to frame ${timestep}` : 'Jumped to frame', icon: 'seek' };
    }
};

export default seekFrame;
