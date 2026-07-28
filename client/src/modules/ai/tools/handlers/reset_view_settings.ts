import { useEditorStore } from '@/modules/canvas/store/editor';

import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/contracts/tools';

interface ResetViewSettingsInput {
    action?: 'undo' | 'redo' | 'reset_all';
}

const resetViewSettings: ClientToolHandler<ResetViewSettingsInput> = {
    name: 'reset_view_settings',
    needsViewer: true,

    run(input, ctx): ClientToolResult {
        const action = input.action;

        if (action !== 'undo' && action !== 'redo' && action !== 'reset_all') {
            return {
                ok: false,
                summary: 'No valid action specified.',
                reason: 'invalid_action',
                hint: 'Use action: "undo", "redo", or "reset_all".'
            };
        }

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
        const action = input.action ?? 'reset';
        if (!result.ok) {
            return {
                label: `View ${action} failed`,
                icon: 'rotate'
            };
        }
        const labels: Record<string, string> = {
            undo: 'Undid view change',
            redo: 'Redid view change',
            reset_all: 'Reset view settings'
        };
        return {
            label: labels[action] ?? 'Adjusted view',
            icon: 'rotate'
        };
    }
};

export default resetViewSettings;
