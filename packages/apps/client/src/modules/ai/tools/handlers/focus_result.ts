import { useCanvasFocusStore } from '@/modules/canvas/store/use-canvas-focus-store';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/contracts/tools';
import type { FocusResultInput } from '@volt/contracts/modules/ai/ai-tools';

const focusResult: ClientToolHandler<FocusResultInput> = {
    name: 'focus_result',
    needsViewer: false,

    run(input): ClientToolResult {
        const focus = useCanvasFocusStore.getState();

        const modifierId = input.modifierId?.trim();

        if (!modifierId) {
            focus.clearFocusedModifier();
            return {
                ok: true,
                summary: 'Cleared the focused result.',
                data: { focusedModifierId: null }
            };
        }

        focus.focusModifier(modifierId);

        return {
            ok: true,
            summary: `Focused result ${modifierId}.`,
            data: { focusedModifierId: modifierId }
        };
    }
};

export default focusResult;
