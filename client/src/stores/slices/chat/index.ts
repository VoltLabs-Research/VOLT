import { create } from 'zustand';
import { combineSlices } from '@/stores/helpers';
import { createChatDataSlice, type ChatDataSlice } from './data-slice';
import { createChatUISlice, type ChatUISlice } from './ui-slice';
import { createChatSocketSlice, type ChatSocketSlice } from './socket-slice';

type ChatStore = ChatDataSlice & ChatUISlice & ChatSocketSlice;

export const useChatStore = create<ChatStore>()(
    combineSlices(createChatDataSlice, createChatUISlice, createChatSocketSlice)
);

export const selectChatData = (s: ChatStore) => ({
    chats: s.chats, currentChat: s.currentChat, messages: s.messages, teamMembers: s.teamMembers,
    isLoading: s.isLoading, isLoadingChats: s.isLoadingChats, isLoadingMessages: s.isLoadingMessages, isConnected: s.isConnected
});

export const selectChatUI = (s: ChatStore) => ({
    showTeamMembers: s.showTeamMembers, showCreateGroup: s.showCreateGroup, showGroupManagement: s.showGroupManagement,
    showEditGroup: s.showEditGroup, showAddMembers: s.showAddMembers, showManageAdmins: s.showManageAdmins,
    showEmojiPicker: s.showEmojiPicker, showMessageOptions: s.showMessageOptions, showReactions: s.showReactions,
    editingMessage: s.editingMessage, editMessageContent: s.editMessageContent, selectedMembers: s.selectedMembers,
    selectedAdmins: s.selectedAdmins, groupName: s.groupName, groupDescription: s.groupDescription,
    editGroupName: s.editGroupName, editGroupDescription: s.editGroupDescription
});

export const selectChatSocket = (s: ChatStore) => ({ typingUsers: s.typingUsers, userPresence: s.userPresence });

export type { ChatDataSlice } from './data-slice';
export type { ChatUISlice } from './ui-slice';
export type { ChatSocketSlice } from './socket-slice';
export default useChatStore;

