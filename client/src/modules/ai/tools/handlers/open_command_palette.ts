import { useCommandPaletteStore } from '@/modules/canvas/stores/use-command-palette-store';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/tools/types';

type CommandPaletteAction = 'open' | 'close' | 'toggle';

interface OpenCommandPaletteInput {
    action?: CommandPaletteAction;
}

const VALID_ACTIONS: readonly CommandPaletteAction[] = ['open', 'close', 'toggle'];

const openCommandPalette: ClientToolHandler<OpenCommandPaletteInput> = {
    name: 'open_command_palette',

    run(input): ClientToolResult {
        const action = input.action;

        if (!action || !VALID_ACTIONS.includes(action)) {
            return {
                ok: false,
                summary: 'Could not control the command palette.',
                reason: 'invalid_action',
                hint: 'action must be one of: open, close, toggle.'
            };
        }

        const palette = useCommandPaletteStore.getState();

        if (action === 'open') {
            palette.open();
        } else if (action === 'close') {
            palette.close();
        } else {
            palette.toggle();
        }

        const isOpen = useCommandPaletteStore.getState().isOpen;

        return {
            ok: true,
            summary: `Command palette ${isOpen ? 'opened' : 'closed'}.`,
            data: { action, isOpen }
        };
    },

    describeEffect(_input, result) {
        if (!result.ok) {
            return { label: 'Command palette unchanged', icon: 'command' };
        }
        const isOpen = (result.data as { isOpen?: boolean } | undefined)?.isOpen;
        return { label: isOpen ? 'Opened command palette' : 'Closed command palette', icon: 'command' };
    }
};

export default openCommandPalette;
