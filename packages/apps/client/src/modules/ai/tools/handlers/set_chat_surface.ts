import { useChatSurfaceStore } from '@/modules/ai/store/use-chat-surface-store';
import type { ClientToolHandler, ClientToolResult } from '@/modules/ai/contracts/tools';
import type { SetChatSurfaceInput } from '@volt/contracts/modules/ai/ai-tools';

const setChatSurface: ClientToolHandler<SetChatSurfaceInput> = {
    name: 'set_chat_surface',

    run(input, ctx): ClientToolResult {
        const { surface } = input;
        const store = useChatSurfaceStore.getState();

        // The conversation moves with the assistant: the turn that asked keeps running in it.
        if (surface === 'page') {
            store.closeWidget();
            ctx.navigate(`/dashboard/ai/${ctx.conversation.conversationId}`);
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

        store.setActive(ctx.conversation);
        store.openWidget();
        return {
            ok: true,
            summary: 'Opened the chat widget.',
            data: { surface }
        };
    }
};

export default setChatSurface;
