import { useEditorStore } from '@/modules/canvas/store/editor';

import { PerformancePreset } from '@/shared/rendering/performance';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/contracts/tools';
import type { SetAppearanceInput } from '@volt/contracts/modules/ai/ai-tools';

const setAppearance: ClientToolHandler<SetAppearanceInput> = {
    name: 'set_appearance',
    needsViewer: true,

    run(input, ctx): ClientToolResult {
        const changes: string[] = [];
        const applied: Record<string, unknown> = {};

        ctx.markViewerActing();
        const store = useEditorStore.getState();

        if (input.pointSize !== undefined) {
            store.setPointSizeMultiplier(input.pointSize);
            const effective = useEditorStore.getState().pointSizeMultiplier;
            applied.pointSize = effective;
            changes.push(`point size ${effective}`);
        }

        if (input.showSimulationCell !== undefined) {
            store.setShowSimulationCell(input.showSimulationCell);
            applied.showSimulationCell = input.showSimulationCell;
            changes.push(input.showSimulationCell ? 'simulation cell on' : 'simulation cell off');
        }

        if (input.quality !== undefined) {
            // The contract declares this as the literal union the LLM may send; it is
            // value-identical to PerformancePreset, which TS keeps nominal for enums.
            store.performanceSettings.setPreset(input.quality as PerformancePreset);
            applied.quality = input.quality;
            changes.push(`quality ${input.quality}`);
        }

        if (changes.length === 0) {
            return {
                ok: false,
                summary: 'No appearance changes requested.',
                reason: 'no_op',
                hint: 'Provide at least one of pointSize, showSimulationCell, or quality.'
            };
        }

        return {
            ok: true,
            summary: `Updated appearance: ${changes.join(', ')}.`,
            data: applied
        };
    },

    describeEffect(_input, result) {
        if (!result.ok) {
            return {
                label: 'Appearance change failed',
                icon: 'sliders'
            };
        }
        return {
            label: 'Adjusted appearance',
            icon: 'sliders'
        };
    }
};

export default setAppearance;
