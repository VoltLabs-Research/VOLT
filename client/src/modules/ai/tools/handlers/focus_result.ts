import { useCanvasFocusStore } from '@/modules/canvas/store/use-canvas-focus-store';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/contracts/tools';

interface FocusResultInput {
    modifierId?: string | null;
}

const focusResult: ClientToolHandler<FocusResultInput> = {
    name: 'focus_result',
    needsViewer: false,

    run(input, _ctx): ClientToolResult {
        const focus = useCanvasFocusStore.getState();
        const raw = input.modifierId;

        if (raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '')) {
            focus.clearFocusedModifier();
            return {
                ok: true,
                summary: 'Cleared the focused result.',
                data: { focusedModifierId: null }
            };
        }

        if (typeof raw !== 'string') {
            return {
                ok: false,
                summary: 'Could not focus the result.',
                reason: 'invalid_modifier_id',
                hint: 'modifierId must be a string id or null.'
            };
        }

        const modifierId = raw.trim();
        focus.focusModifier(modifierId);

        return {
            ok: true,
            summary: `Focused result ${modifierId}.`,
            data: { focusedModifierId: modifierId }
        };
    },

    describeEffect(input, result) {
        if (!result.ok) {
            return {
                label: 'Focus unchanged',
                icon: 'focus'
            };
        }
        const cleared = input.modifierId === null || input.modifierId === undefined || input.modifierId === '';
        return {
            label: cleared ? 'Cleared focus' : 'Focused result',
            icon: 'focus'
        };
    }
};

export default focusResult;
