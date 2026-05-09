import type { KeyboardEvent, ReactNode } from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { IoSettingsOutline, IoPeopleOutline, IoShieldOutline } from 'react-icons/io5';
import AdminsTab from './tabs/AdminsTab';
import GeneralTab from './tabs/GeneralTab';
import MembersTab from './tabs/MembersTab';
import { cn } from '@/shared/utils/cn';
import { toggleSelection } from '@/shared/utils/selection';
import Box from '@/shared/presentation/primitives/Box';
import Button from '@/shared/presentation/primitives/Button';
import Modal from '@/shared/presentation/primitives/Modal';
import Row from '@/shared/presentation/primitives/Row';
import Text from '@/shared/presentation/primitives/Text';
import { confirm } from '@/shared/presentation/hooks/use-confirm';
import type { User } from '@/modules/auth/api/entities/user';
import type { Chat } from '@/modules/chat/api/entities/chat';
import './GroupManagementModal.css';

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

const TABS: GroupManagementTab[] = [
    {
        id: Tab.General,
        label: 'General',
        icon: <IoSettingsOutline />
    },
    {
        id: Tab.Members,
        label: 'Members',
        icon: <IoPeopleOutline />
    },
    {
        id: Tab.Admins,
        label: 'Admins',
        icon: <IoShieldOutline />
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

    const isOwner = chat?.createdBy?._id === currentUserId;
    const isAdmin = chat?.admins?.some((a) => a._id === currentUserId) ?? false;
    const canEdit = isOwner || isAdmin;

    const availableMembers = useMemo(() => {
        if (!chat) return [];
        const existingIds = chat.participants.map((p) => p._id);
        return teamMembers.filter((m) => !existingIds.includes(m._id));
    }, [chat, teamMembers]);

    useEffect(() => {
        if (chat) {
            setGroupName(chat.groupName || '');
            setGroupDescription(chat.groupDescription || '');
        }
    }, [chat]);

    if (!chat || !chat.isGroup) return null;

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
        const nextTab = TABS[nextIndex];
        if (!nextTab) {
            return;
        }

        setActiveTab(nextTab.id);
        tabButtonRefs.current[nextIndex]?.focus();
    };

    return (
        <Modal id='group-management-modal' title='Group Settings' width='600px'>
            <Row gap='05' className='group-management-tabs' role='tablist' aria-label='Group settings sections'>
                {TABS.map((tab, index) => (
                    <Button
                        key={tab.id}
                        ref={(node) => {
                            tabButtonRefs.current[index] = node;
                        }}
                        variant='ghost'
                        intent='neutral'
                        id={getTabButtonId(tab.id)}
                        role='tab'
                        aria-selected={activeTab === tab.id}
                        aria-controls={getTabPanelId(tab.id)}
                        tabIndex={activeTab === tab.id ? 0 : -1}
                        className={cn(
                            'd-flex items-center gap-05 group-management-tab transition-normal cursor-pointer color-secondary',
                            activeTab === tab.id && 'active'
                        )}
                        onClick={() => setActiveTab(tab.id)}
                        onKeyDown={(event) => handleTabKeyDown(event, index)}
                    >
                        {tab.icon}
                        <Text as='p' size='md'>{tab.label}</Text>
                    </Button>
                ))}
            </Row>

            <Box id={getTabPanelId(activeTab)} role='tabpanel' aria-labelledby={getTabButtonId(activeTab)} tabIndex={0} className='group-management-content'>
                {activeTab === Tab.General && (
                    <GeneralTab
                        chat={chat}
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
            </Box>
        </Modal>
    );
};

export default GroupManagementModal;
