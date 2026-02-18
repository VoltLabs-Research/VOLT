import { useState, useEffect, useMemo } from 'react';
import { IoSettingsOutline, IoPeopleOutline, IoShieldOutline } from 'react-icons/io5';
import type { Chat } from '@/modules/chat/domain/entities';
import type { User } from '@/modules/auth/domain/entities';
import Modal from '@/shared/presentation/components/Modal';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Button from '@/shared/presentation/components/Button';
import useAsyncAction from '@/shared/presentation/hooks/use-async-action';
import { cn } from '@/shared/utils';
import { toggleSelection } from '@/shared/utils/selection';
import { GeneralTab, MembersTab, AdminsTab } from './tabs';
import './GroupManagementModal.css';

type Tab = 'general' | 'members' | 'admins';

interface GroupManagementModalProps {
    chat: Chat | null;
    teamMembers: User[];
    currentUserId?: string;
    onUpdateInfo: (chatId: string, name: string, description: string) => Promise<unknown>;
    onAddMembers: (chatId: string, memberIds: string[]) => Promise<unknown>;
    onUpdateAdmins: (chatId: string, adminIds: string[], action: 'add' | 'remove') => Promise<unknown>;
    onLeaveGroup: (chatId: string) => Promise<unknown>;
};

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: 'General', icon: <IoSettingsOutline /> },
    { id: 'members', label: 'Members', icon: <IoPeopleOutline /> },
    { id: 'admins', label: 'Admins', icon: <IoShieldOutline /> },
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
    const [activeTab, setActiveTab] = useState<Tab>('general');
    const [groupName, setGroupName] = useState('');
    const [groupDescription, setGroupDescription] = useState('');
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const { isLoading, execute } = useAsyncAction();

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

    const handleSaveInfo = () => execute(async () => {
        if (groupName.trim()) {
            await onUpdateInfo(chat._id, groupName.trim(), groupDescription.trim());
        }
    });

    const handleAddMembers = () => execute(async () => {
        if (selectedMembers.length > 0) {
            await onAddMembers(chat._id, selectedMembers);
            setSelectedMembers([]);
        }
    });

    const handleToggleAdmin = (userId: string) => execute(async () => {
        const isCurrentAdmin = chat.admins?.some((a) => a._id === userId);
        await onUpdateAdmins(chat._id, [userId], isCurrentAdmin ? 'remove' : 'add');
    });

    const handleLeave = () => execute(async () => {
        if (confirm('Are you sure you want to leave this group?')) {
            await onLeaveGroup(chat._id);
        }
    });

    const toggleSelectedMember = (id: string) => {
        setSelectedMembers((prev) => toggleSelection(prev, id));
    };

    return (
        <Modal id='group-management-modal' title='Group Settings' width='600px'>
            <Container className='d-flex gap-05 group-management-tabs'>
                {TABS.map((tab) => (
                    <Button
                        key={tab.id}
                        variant='ghost'
                        intent='neutral'
                        className={cn(
                            'd-flex items-center gap-05 group-management-tab transition-normal cursor-pointer color-secondary',
                            activeTab === tab.id && 'active'
                        )}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.icon}
                        <Paragraph className='font-size-2'>{tab.label}</Paragraph>
                    </Button>
                ))}
            </Container>

            <Container className='group-management-content'>
                {activeTab === 'general' && (
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

                {activeTab === 'members' && (
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

                {activeTab === 'admins' && (
                    <AdminsTab
                        chat={chat}
                        isOwner={isOwner}
                        isLoading={isLoading}
                        onToggleAdmin={handleToggleAdmin}
                    />
                )}
            </Container>
        </Modal>
    );
};

export default GroupManagementModal;
