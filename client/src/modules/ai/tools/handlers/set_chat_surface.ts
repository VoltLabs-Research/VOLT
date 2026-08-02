import { useChatSurfaceStore } from '@/modules/ai/store/use-chat-surface-store';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/contracts/tools';
import type { SetChatSurfaceInput } from '@volt/contracts/modules/ai/ai-tools';

const EFFECT_LABELS: Record<SetChatSurfaceInput['surface'], string> = {
    page: 'Opened the AI page',
    hidden: 'Hid the chat widget',
    floating: 'Opened the chat widget'
};

const setChatSurface: ClientToolHandler<SetChatSurfaceInput> = {
    name: 'set_chat_surface',

    run(input, ctx): ClientToolResult {
        const { surface } = input;
        const store = useChatSurfaceStore.getState();

        if (surface === 'page') {
            store.closeWidget();
            ctx.navigate('/dashboard/ai');
            return {
                ok: true,
                summary: 'Opened the full AI page.',
                data: { surface }
            };
        }

        if (surface === 'hidden') {
            store.closeWidget();
            return {
                ok: true,
                summary: 'Hid the chat widget.',
                data: { surface }
            };
        }

        store.openWidget();
        return {
            ok: true,
            summary: 'Opened the chat widget.',
            data: { surface }
        };
    },

    describeEffect(input) {
        return {
            label: EFFECT_LABELS[input.surface],
            icon: 'chat'
        };
    }
};

export default setChatSurface;
