import { useCanvasFocusStore } from '@/modules/canvas/stores/use-canvas-focus-store';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/tools/types';

interface FocusResultInput {
    modifierId?: string | null;
}

/**
 * Focuses (highlights) a specific analysis result / modifier in the canvas UI,
 * or clears the current focus when `modifierId` is null. Drives the canvas focus
 * store directly. This is a pure UI-state change (no 3D viewer mutation), so it
 * does not require a mounted canvas.
 */
const focusResult: ClientToolHandler<FocusResultInput> = {
    name: 'focus_result',
    needsViewer: false,

    run(input, _ctx): ClientToolResult {
        const focus = useCanvasFocusStore.getState();
        const raw = input.modifierId;

        // null / undefined / empty string all mean "clear the focus".
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
            return { label: 'Focus unchanged', icon: 'focus' };
        }
        const cleared = input.modifierId === null || input.modifierId === undefined || input.modifierId === '';
        return { label: cleared ? 'Cleared focus' : 'Focused result', icon: 'focus' };
    }
};

export default focusResult;
