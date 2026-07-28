import { useEditorStore } from '@/modules/canvas/store/editor';
import { isPerformancePreset } from '@/shared/rendering/performance';

import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/contracts/tools';
import type { PerformancePreset } from '@/shared/rendering/performance';

interface SetAppearanceInput {
    pointSize?: number;
    showSimulationCell?: boolean;
    quality?: string;
}

const setAppearance: ClientToolHandler<SetAppearanceInput> = {
    name: 'set_appearance',
    needsViewer: true,

    run(input, ctx): ClientToolResult {
        const changes: string[] = [];
        const applied: Record<string, unknown> = {};

        ctx.markViewerActing();
        const store = useEditorStore.getState();

        if (typeof input.pointSize === 'number' && Number.isFinite(input.pointSize)) {
            store.setPointSizeMultiplier(input.pointSize);
            const effective = useEditorStore.getState().pointSizeMultiplier;
            applied.pointSize = effective;
            changes.push(`point size ${effective}`);
        }

        if (typeof input.showSimulationCell === 'boolean') {
            store.setShowSimulationCell(input.showSimulationCell);
            applied.showSimulationCell = input.showSimulationCell;
            changes.push(input.showSimulationCell ? 'simulation cell on' : 'simulation cell off');
        }

        if (typeof input.quality === 'string' && input.quality) {
            const preset = input.quality.toLowerCase();
            if (!isPerformancePreset(preset)) {
                return {
                    ok: false,
                    summary: `Unknown quality preset "${input.quality}".`,
                    reason: 'invalid_quality',
                    hint: 'Use one of: ultra, high, balanced, performance, battery.'
                };
            }
            store.performanceSettings.setPreset(preset as PerformancePreset);
            applied.quality = preset;
            changes.push(`quality ${preset}`);
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
            return { label: 'Appearance change failed', icon: 'sliders' };
        }
        return { label: 'Adjusted appearance', icon: 'sliders' };
    }
};

export default setAppearance;
