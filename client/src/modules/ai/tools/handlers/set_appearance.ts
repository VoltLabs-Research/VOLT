import { useEditorStore } from '@/modules/canvas/stores/editor';
import { isPerformancePreset } from '@/shared/domain/rendering/performance';

import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/tools/types';
import type { PerformancePreset } from '@/shared/domain/rendering/performance';

interface SetAppearanceInput {
    pointSize?: number;
    showSimulationCell?: boolean;
    quality?: string;
}

/**
 * Adjusts viewer appearance: point size, simulation-cell visibility, render
 * quality preset. Maps to the editor store's `setPointSizeMultiplier`,
 * `setShowSimulationCell`, and `performanceSettings.setPreset`. All changes are
 * zundo-tracked, so they are user-undoable.
 */
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
            // setPointSizeMultiplier clamps to [0.1, 5.0]; read back the effective value.
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
