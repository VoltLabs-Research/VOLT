import { useEditorStore } from '@/modules/canvas/store/editor';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/contracts/tools';
import type { SeekFrameInput } from '@volt/contracts/modules/ai/ai-tools';

const closestTimestep = (timesteps: number[], frame: number): number => {
    return timesteps.reduce((closest, timestep) => {
        return Math.abs(timestep - frame) < Math.abs(closest - frame) ? timestep : closest;
    }, timesteps[0]);
};

const seekFrame: ClientToolHandler<SeekFrameInput> = {
    name: 'seek_frame',
    needsViewer: true,

    run(input, ctx): ClientToolResult {
        const { timesteps, currentTimestep } = ctx.getCanvasBridge();

        if (timesteps.length === 0) {
            return {
                ok: false,
                summary: 'Cannot seek — no trajectory frames are loaded.',
                reason: 'no_trajectory',
                hint: 'Open a trajectory with timesteps in the viewer first.'
            };
        }

        const { frame } = input;
        let target: number | undefined;

        if (frame !== undefined) {
            target = timesteps.includes(frame) ? frame : closestTimestep(timesteps, frame);
        } else if (input.position) {
            const currentIndex = currentTimestep === undefined ? -1 : timesteps.indexOf(currentTimestep);
            const base = currentIndex === -1 ? 0 : currentIndex;

            switch (input.position) {
                case 'first':
                    target = timesteps[0];
                    break;
                case 'last':
                    target = timesteps[timesteps.length - 1];
                    break;
                case 'next':
                    target = timesteps[Math.min(base + 1, timesteps.length - 1)];
                    break;
                case 'previous':
                    target = timesteps[Math.max(base - 1, 0)];
                    break;
            }
        }

        if (target === undefined) {
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
            data: {
                timestep: target,
                index: timesteps.indexOf(target),
                totalFrames: timesteps.length
            }
        };
    },

    describeEffect(_input, result) {
        if (!result.ok) {
            return {
                label: 'Seek failed',
                icon: 'seek'
            };
        }
        const timestep = (result.data as { timestep?: number } | undefined)?.timestep;
        return {
            label: timestep !== undefined ? `Jumped to frame ${timestep}` : 'Jumped to frame',
            icon: 'seek'
        };
    }
};

export default seekFrame;
