import type { SliceCreator } from '@/shared/presentation/stores/helpers';

export interface ChatUIState {
    showTeamMembers: boolean;
    showCreateGroup: boolean;
    showGroupManagement: boolean;
    showEditGroup: boolean;
    showAddMembers: boolean;
    showManageAdmins: boolean;
    showEmojiPicker: boolean;
    showMessageOptions: string | null;
    showReactions: string | null;
    editingMessage: string | null;
    editMessageContent: string;
    selectedMembers: string[];
    selectedAdmins: string[];
    groupName: string;
    groupDescription: string;
    editGroupName: string;
    editGroupDescription: string;
    callState: 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';
}

export interface ChatUIActions {
    setShowTeamMembers: (show: boolean) => void;
    setShowCreateGroup: (show: boolean) => void;
    setShowGroupManagement: (show: boolean) => void;
    setShowEditGroup: (show: boolean) => void;
    setShowAddMembers: (show: boolean) => void;
    setShowManageAdmins: (show: boolean) => void;
    setShowEmojiPicker: (show: boolean) => void;
    setShowMessageOptions: (messageId: string | null) => void;
    setShowReactions: (messageId: string | null) => void;
    setEditingMessage: (messageId: string | null) => void;
    setEditMessageContent: (content: string) => void;
    setSelectedMembers: (members: string[]) => void;
    setSelectedAdmins: (admins: string[]) => void;
    setGroupName: (name: string) => void;
    setGroupDescription: (description: string) => void;
    setEditGroupName: (name: string) => void;
    setEditGroupDescription: (description: string) => void;
    toggleMemberSelection: (memberId: string) => void;
    toggleAdminSelection: (adminId: string) => void;
    resetModalStates: () => void;
}

export type ChatUISlice = ChatUIState & ChatUIActions;

export const initialUIState: ChatUIState = {
    showTeamMembers: false,
    showCreateGroup: false,
    showGroupManagement: false,
    showEditGroup: false,
    showAddMembers: false,
    showManageAdmins: false,
    showEmojiPicker: false,
    showMessageOptions: null,
    showReactions: null,
    editingMessage: null,
    editMessageContent: '',
    selectedMembers: [],
    selectedAdmins: [],
    groupName: '',
    groupDescription: '',
    editGroupName: '',
    editGroupDescription: '',
    callState: 'idle'
};

export const createChatUISlice: SliceCreator<ChatUISlice> = (set) => ({
    ...initialUIState,
    setShowTeamMembers: (show) => set({ showTeamMembers: show }),
    setShowCreateGroup: (show) => set({ showCreateGroup: show }),
    setShowGroupManagement: (show) => set({ showGroupManagement: show }),
    setShowEditGroup: (show) => set({ showEditGroup: show }),
    setShowAddMembers: (show) => set({ showAddMembers: show }),
    setShowManageAdmins: (show) => set({ showManageAdmins: show }),
    setShowEmojiPicker: (show) => set({ showEmojiPicker: show }),
    setShowMessageOptions: (id) => set({ showMessageOptions: id }),
    setShowReactions: (id) => set({ showReactions: id }),
    setEditingMessage: (id) => set({ editingMessage: id }),
    setEditMessageContent: (content) => set({ editMessageContent: content }),
    setSelectedMembers: (members) => set({ selectedMembers: members }),
    setSelectedAdmins: (admins) => set({ selectedAdmins: admins }),
    setGroupName: (name) => set({ groupName: name }),
    setGroupDescription: (desc) => set({ groupDescription: desc }),
    setEditGroupName: (name) => set({ editGroupName: name }),
    setEditGroupDescription: (desc) => set({ editGroupDescription: desc }),
    toggleMemberSelection: (id) => set((s: any) => ({ 
        selectedMembers: s.selectedMembers.includes(id) ? s.selectedMembers.filter((x: string) => x !== id) : [...s.selectedMembers, id] 
    })),
    toggleAdminSelection: (id) => set((s: any) => ({ 
        selectedAdmins: s.selectedAdmins.includes(id) ? s.selectedAdmins.filter((x: string) => x !== id) : [...s.selectedAdmins, id] 
    })),
    resetModalStates: () => set(initialUIState)
});
