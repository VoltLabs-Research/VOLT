import { useChatSurfaceStore } from '@/modules/ai/store/use-chat-surface-store';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/contracts/tools';

interface SetChatSurfaceInput {
    surface?: 'floating' | 'page' | 'hidden';
}

const setChatSurface: ClientToolHandler<SetChatSurfaceInput> = {
    name: 'set_chat_surface',

    run(input, ctx): ClientToolResult {
        const surface = input.surface ?? 'floating';
        const store = useChatSurfaceStore.getState();

        if (surface === 'page') {
            store.closeWidget();
            ctx.navigate('/dashboard/ai');
            return { ok: true, summary: 'Opened the full AI page.', data: { surface } };
        }

        if (surface === 'hidden') {
            store.closeWidget();
            return { ok: true, summary: 'Hid the chat widget.', data: { surface } };
        }

        store.openWidget();
        return { ok: true, summary: 'Opened the chat widget.', data: { surface } };
    },

    describeEffect(input) {
        const surface = input.surface ?? 'floating';
        const label = surface === 'page'
            ? 'Opened the AI page'
            : surface === 'hidden'
                ? 'Hid the chat widget'
                : 'Opened the chat widget';
        return { label, icon: 'chat' };
    }
};

export default setChatSurface;
