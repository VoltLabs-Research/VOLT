import { create } from 'zustand';
import { createChatDataSlice } from './data-slice';
import { createChatSocketSlice } from './socket-slice';
import { createChatUISlice } from './ui-slice';
import type { ChatDataSlice } from './data-slice';
import type { ChatSocketSlice } from './socket-slice';
import type { ChatUISlice } from './ui-slice';

export type ChatStore = ChatDataSlice & ChatSocketSlice & ChatUISlice;

export const useChatStore = create<ChatStore>()((set, get, store) => ({
    ...createChatDataSlice(set, get, store),
    ...createChatSocketSlice(set, get, store),
    ...createChatUISlice(set, get, store)
}));

export * from './data-slice';
export * from './socket-slice';
export * from './ui-slice';
