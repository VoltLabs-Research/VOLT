import { useEditorStore } from '@/modules/canvas/store/editor';

import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/contracts/tools';
import type { ResetViewSettingsInput } from '@volt/contracts/modules/ai/ai-tools';

const EFFECT_LABELS: Record<ResetViewSettingsInput['action'], string> = {
    undo: 'Undid view change',
    redo: 'Redid view change',
    reset_all: 'Reset view settings'
};

const resetViewSettings: ClientToolHandler<ResetViewSettingsInput> = {
    name: 'reset_view_settings',
    needsViewer: true,

    run(input, ctx): ClientToolResult {
        const { action } = input;

        ctx.markViewerActing();

        if (action === 'reset_all') {
            useEditorStore.getState().resetAll();
            return {
                ok: true,
                summary: 'Reset all viewer settings to defaults.',
                data: { action }
            };
        }

        const temporal = useEditorStore.temporal.getState();

        if (action === 'undo') {
            if (temporal.pastStates.length === 0) {
                return {
                    ok: false,
                    summary: 'Nothing to undo.',
                    reason: 'empty_history',
                    hint: 'No earlier viewer state is recorded.'
                };
            }
            temporal.undo();
            return {
                ok: true,
                summary: 'Undid the last viewer change.',
                data: { action }
            };
        }

        if (temporal.futureStates.length === 0) {
            return {
                ok: false,
                summary: 'Nothing to redo.',
                reason: 'empty_history',
                hint: 'No undone viewer change is available to redo.'
            };
        }
        temporal.redo();
        return {
            ok: true,
            summary: 'Redid the last undone viewer change.',
            data: { action }
        };
    },

    describeEffect(input, result) {
        if (!result.ok) {
            return {
                label: `View ${input.action} failed`,
                icon: 'rotate'
            };
        }
        return {
            label: EFFECT_LABELS[input.action],
            icon: 'rotate'
        };
    }
};

export default resetViewSettings;
