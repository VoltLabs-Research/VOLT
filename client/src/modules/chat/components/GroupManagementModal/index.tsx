import type { KeyboardEvent, ReactNode } from 'react';
import { useState, useEffect, useRef } from 'react';
import { Settings, Shield, Users } from 'lucide-react';
import AdminsTab from './tabs/AdminsTab';
import GeneralTab from './tabs/GeneralTab';
import MembersTab from './tabs/MembersTab';
import { cn } from '@heroui/react';
import { toggleSelection } from '@/shared/utils/selection';
import { Modal } from '@/shared/ui/modal';
import { confirm } from '@/shared/ui/hooks/use-confirm';

/* Shared so ChatDetailsPanel's trigger and this modal cannot drift apart — the id
   was a bare string in both, which only held together because the native <dialog>
   matched them at runtime via `commandfor`. */
export const GROUP_MANAGEMENT_MODAL_ID = 'group-management-modal';
import type { User } from '@volt/contracts/modules/auth/domain';
import type { Chat } from '@volt/contracts/modules/chat/domain';

enum Tab {
    General = 'general',
    Members = 'members',
    Admins = 'admins'
}

interface GroupManagementTab {
    id: Tab;
    label: string;
    icon: ReactNode;
}

interface GroupManagementModalProps {
    chat: Chat | null;
    teamMembers: User[];
    currentUserId?: string;
    onUpdateInfo: (chatId: string, name: string, description: string) => Promise<unknown>;
    onAddMembers: (chatId: string, memberIds: string[]) => Promise<unknown>;
    onUpdateAdmins: (chatId: string, adminIds: string[], action: 'add' | 'remove') => Promise<unknown>;
    onLeaveGroup: (chatId: string) => Promise<unknown>;
}

/*
 * The tablist stays hand-rolled on plain `<button>`s rather than becoming HeroUI's
 * `Tabs`. It owns a roving `tabIndex`, a ref per tab and its own
 * arrow/Home/End handling, and every one of those is a prop HeroUI's `Button`
 * closes off — `role`, `tabIndex` and `ref` all go straight to a DOM button here.
 * What the old bravais Button contributed visually was nothing: the padding, the
 * 2px underline and the active colour all came from GroupManagementModal.css,
 * which is now this pair of literals.
 */
const TAB_CLASS_NAMES = 'flex items-center gap-2 px-4 py-3 border-b-2 border-transparent bg-transparent text-muted cursor-pointer transition-colors duration-200 ease-out-fluid [&_svg]:size-4 hover:text-foreground focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--focus)]';

const ACTIVE_TAB_CLASS_NAMES = 'border-b-accent text-accent';

const TABS: GroupManagementTab[] = [
    {
        id: Tab.General,
        label: 'General',
        icon: <Settings />
    },
    {
        id: Tab.Members,
        label: 'Members',
        icon: <Users />
    },
    {
        id: Tab.Admins,
        label: 'Admins',
        icon: <Shield />
    }
];

const GroupManagementModal = ({
    chat,
    teamMembers,
    currentUserId,
    onUpdateInfo,
    onAddMembers,
    onUpdateAdmins,
    onLeaveGroup
}: GroupManagementModalProps) => {
    const [activeTab, setActiveTab] = useState<Tab>(Tab.General);
    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const tabButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (chat) {
            setGroupName(chat.groupName || '');
            setGroupDescription(chat.groupDescription || '');
        }
    }, [chat]);

    if (!chat || !chat.isGroup) return null;

    const isOwner = chat.createdBy?._id === currentUserId;
    const isAdmin = chat.admins?.some((a) => a._id === currentUserId) ?? false;
    const canEdit = isOwner || isAdmin;

    const existingMemberIds = chat.participants.map((p) => p._id);
    const availableMembers = teamMembers.filter((m) => !existingMemberIds.includes(m._id));

    const runAsync = async (action: () => Promise<void>) => {
        setIsLoading(true);

        try {
            await action();
        } catch {
            // The caller already handles user-facing failures.
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveInfo = () => runAsync(async () => {
        if (groupName.trim()) {
            await onUpdateInfo(chat._id, groupName.trim(), groupDescription.trim());
        }
    });

    const handleAddMembers = () => runAsync(async () => {
        if (selectedMembers.length > 0) {
            await onAddMembers(chat._id, selectedMembers);
            setSelectedMembers([]);
        }
    });

    const handleToggleAdmin = (userId: string) => runAsync(async () => {
        const isCurrentAdmin = chat.admins?.some((a) => a._id === userId);
        await onUpdateAdmins(chat._id, [userId], isCurrentAdmin ? 'remove' : 'add');
    });

    const handleLeave = () => runAsync(async () => {
        const isConfirmed = await confirm({
            title: 'Leave this group?',
            confirmText: 'Leave'
        });

        if (!isConfirmed) {
            return;
        }

        await onLeaveGroup(chat._id);
    });

    const toggleSelectedMember = (id: string) => {
        setSelectedMembers((prev) => toggleSelection(prev, id));
    };

    const getTabButtonId = (tab: Tab) => `group-management-tab-${tab}`;
    const getTabPanelId = (tab: Tab) => `group-management-panel-${tab}`;

    const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const lastIndex = TABS.length - 1;
        let nextIndex = index;

        if (event.key === 'ArrowRight') {
            nextIndex = index === lastIndex ? 0 : index + 1;
        } else if (event.key === 'ArrowLeft') {
            nextIndex = index === 0 ? lastIndex : index - 1;
        } else if (event.key === 'Home') {
            nextIndex = 0;
        } else if (event.key === 'End') {
            nextIndex = lastIndex;
        } else {
            return;
        }

        event.preventDefault();
        setActiveTab(TABS[nextIndex].id);
        tabButtonRefs.current[nextIndex]?.focus();
    };

    return (
        <Modal id={GROUP_MANAGEMENT_MODAL_ID} title='Group Settings' width='600px'>
            <div className='flex flex-row items-center gap-2 border-b border-border' role='tablist' aria-label='Group settings sections'>
                {TABS.map((tab, index) => (
                    <button
                        key={tab.id}
                        type='button'
                        ref={(node) => {
                            tabButtonRefs.current[index] = node;
                        }}
                        id={getTabButtonId(tab.id)}
                        role='tab'
                        aria-selected={activeTab === tab.id}
                        aria-controls={getTabPanelId(tab.id)}
                        tabIndex={activeTab === tab.id ? 0 : -1}
                        className={cn(TAB_CLASS_NAMES, activeTab === tab.id && ACTIVE_TAB_CLASS_NAMES)}
                        onClick={() => setActiveTab(tab.id)}
                        onKeyDown={(event) => handleTabKeyDown(event, index)}
                    >
                        {tab.icon}
                        <p className='text-sm'>{tab.label}</p>
                    </button>
                ))}
            </div>

            <div id={getTabPanelId(activeTab)} role='tabpanel' aria-labelledby={getTabButtonId(activeTab)} tabIndex={0}>
                {activeTab === Tab.General && (
                    <GeneralTab
                        groupName={groupName}
                        groupDescription={groupDescription}
                        isLoading={isLoading}
                        canEdit={canEdit}
                        onNameChange={setGroupName}
                        onDescriptionChange={setGroupDescription}
                        onSave={handleSaveInfo}
                        onLeave={handleLeave}
                    />
                )}

                {activeTab === Tab.Members && (
                    <MembersTab
                        chat={chat}
                        availableMembers={availableMembers}
                        selectedMembers={selectedMembers}
                        currentUserId={currentUserId}
                        isLoading={isLoading}
                        canEdit={canEdit}
                        onToggleSelected={toggleSelectedMember}
                        onAddMembers={handleAddMembers}
                    />
                )}

                {activeTab === Tab.Admins && (
                    <AdminsTab
                        chat={chat}
                        isOwner={isOwner}
                        isLoading={isLoading}
                        onToggleAdmin={handleToggleAdmin}
                    />
                )}
            </div>
        </Modal>
    );
};

export default GroupManagementModal;
