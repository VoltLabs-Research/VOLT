import { useCommandPaletteStore } from '@/modules/canvas/store/use-command-palette-store';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/contracts/tools';
import type { OpenCommandPaletteInput } from '@volt/contracts/modules/ai/ai-tools';

const openCommandPalette: ClientToolHandler<OpenCommandPaletteInput> = {
    name: 'open_command_palette',

    run(input): ClientToolResult {
        const { action } = input;
        const palette = useCommandPaletteStore.getState();

        if (action === 'open') {
            palette.open();
        } else if (action === 'close') {
            palette.close();
        } else {
            palette.toggle();
        }

        const { isOpen } = useCommandPaletteStore.getState();

        return {
            ok: true,
            summary: `Command palette ${isOpen ? 'opened' : 'closed'}.`,
            data: {
                action,
                isOpen
            }
        };
    },

    describeEffect(_input, result) {
        const isOpen = (result.data as { isOpen?: boolean } | undefined)?.isOpen;
        return {
            label: isOpen ? 'Opened command palette' : 'Closed command palette',
            icon: 'command'
        };
    }
};

export default openCommandPalette;
