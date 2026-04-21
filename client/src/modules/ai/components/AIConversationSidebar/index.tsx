import { matchesQuery } from '@/shared/utils/matches-query';
import EmptyState from '@/shared/presentation/components/EmptyState';
import IconButton from '@/shared/presentation/components/IconButton';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import SearchInput from '@/shared/presentation/components/SearchInput';
import SidebarNavItem from '@/shared/presentation/components/SidebarNavItem';
import Tooltip from '@/shared/presentation/components/Tooltip';
import { confirm } from '@/shared/presentation/hooks/use-confirm';
import { formatDistanceToNow } from 'date-fns';
import { useMemo, useState } from 'react';
import { CiChat1 } from 'react-icons/ci';
import { IoPencilOutline, IoTrashOutline } from 'react-icons/io5';
import type { AIConversation } from '@/modules/ai/api/entities/ai-conversation';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import './AIConversationSidebar.css';

interface AIConversationSidebarProps {
    conversations: AIConversation[];
    activeConversationId?: string;
    isLoading?: boolean;
    error?: string | null;
    canCreate?: boolean;
    canUpdate?: boolean;
    canDelete?: boolean;
    onCreateConversation: () => void;
    onSelectConversation: (conversationId: string) => void;
    onDeleteConversation: (conversationId: string) => Promise<void>;
    onRenameConversation: (conversationId: string, title: string) => Promise<void>;
};

const AIConversationSidebar = ({
    conversations,
    activeConversationId,
    isLoading = false,
    error,
    canCreate = true,
    canUpdate = true,
    canDelete = true,
    onCreateConversation,
    onSelectConversation,
    onDeleteConversation,
    onRenameConversation
}: AIConversationSidebarProps) => {
    const [query, setQuery] = useState('');
    const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
    const [draftTitle, setDraftTitle] = useState('');
    const filteredConversations = useMemo(() => {
        return conversations.filter((conversation) => (
            matchesQuery(conversation.title, query)
        ));
    }, [conversations, query]);

    const beginEditing = (conversation: AIConversation) => {
        setEditingConversationId(conversation._id);
        setDraftTitle(conversation.title);
    };

    const finishEditing = async () => {
        if (!editingConversationId) {
            return;
        }

        const nextTitle = draftTitle.trim();
        if (nextTitle) {
            await onRenameConversation(editingConversationId, nextTitle);
        }

        setEditingConversationId(null);
        setDraftTitle('');
    };

    const handleDeleteConversation = async (conversationId: string) => {
        const isConfirmed = await confirm({
            title: 'Delete this conversation?',
            confirmText: 'Delete'
        });

        if (!isConfirmed) {
            return;
        }

        await onDeleteConversation(conversationId);
    };

    const handleFinishEditing = () => finishEditing().catch(console.warn);

    const handleEditingKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            finishEditing().catch(console.warn);
        }

        if (event.key === 'Escape') {
            setEditingConversationId(null);
            setDraftTitle('');
        }
    };

    const createRenameClickHandler = (conversation: AIConversation) => (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        beginEditing(conversation);
    };

    const createDeleteClickHandler = (conversationId: string) => (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        handleDeleteConversation(conversationId).catch(console.warn);
    };

    const renderConversationTitle = (conversation: AIConversation) => {
        let content: ReactNode = (
            <p className='volt-text font-size-2 font-weight-5 color-primary ai-conversation-title'>
                {conversation.title || 'Untitled conversation'}
            </p>
        );

        if (editingConversationId === conversation._id) {
            content = (
                <input
                    className='ai-conversation-title-input'
                    value={draftTitle}
                    autoFocus
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onBlur={handleFinishEditing}
                    onKeyDown={handleEditingKeyDown}
                    onClick={(event: MouseEvent<HTMLElement>) => event.stopPropagation()}
                />
            );
        }

        return content;
    };

    const renderConversationItem = (conversation: AIConversation) => {
        const isActive = conversation._id === activeConversationId;
        let itemClassName = 'd-flex column gap-025 ai-conversation-item cursor-pointer';
        if (isActive) {
            itemClassName = 'd-flex column gap-025 ai-conversation-item cursor-pointer is-active';
        }

        let renameTooltip = 'You do not have permission to rename conversations.';
        if (canUpdate) {
            renameTooltip = 'Rename conversation';
        }

        let deleteTooltip = 'You do not have permission to delete conversations.';
        if (canDelete) {
            deleteTooltip = 'Delete conversation';
        }

        return (
            <button
                key={conversation._id}
                type='button'
                className={itemClassName}
                onClick={() => onSelectConversation(conversation._id)}
            >
                <div className='volt-container d-flex items-center content-between gap-05'>
                    {renderConversationTitle(conversation)}

                    <div className='volt-container d-flex items-center gap-025 ai-conversation-item-actions'>
                        <Tooltip content={renameTooltip}>
                            <IconButton
                                aria-label={`Rename conversation ${conversation.title}`}
                                size='sm'
                                variant='ghost'
                                disabled={!canUpdate}
                                onClick={createRenameClickHandler(conversation)}
                            >
                                <IoPencilOutline size={14} />
                            </IconButton>
                        </Tooltip>

                        <Tooltip content={deleteTooltip}>
                            <IconButton
                                aria-label={`Delete conversation ${conversation.title}`}
                                size='sm'
                                variant='ghost'
                                disabled={!canDelete}
                                onClick={createDeleteClickHandler(conversation._id)}
                            >
                                <IoTrashOutline size={14} />
                            </IconButton>
                        </Tooltip>
                    </div>
                </div>

                <p className='volt-text font-size-1 color-muted'>
                    {formatDistanceToNow(new Date(conversation.lastMessageAt || conversation.updatedAt), { addSuffix: true })}
                </p>
            </button>
        );
    };

    let listContent: ReactNode = filteredConversations.map(renderConversationItem);

    if (isLoading) {
        listContent = Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className='volt-container ai-conversation-item-skeleton' />
        ));
    } else if (filteredConversations.length === 0) {
        let title = 'No conversations yet';
        let description = 'Create a new chat to get started.';
        if (query) {
            title = 'No matching conversations';
            description = 'No matching conversations found.';
        } else if (!canCreate) {
            title = 'No conversations available';
            description = 'You do not have permission to start a conversation here.';
        }

        listContent = (
            <EmptyState
                title={title}
                description={description}
            />
        );
    }

    let createConversationClick = undefined;
    if (canCreate) {
        createConversationClick = onCreateConversation;
    }

    return (
        <div className='volt-container d-flex column h-max ai-conversation-sidebar'>
            <div className='volt-container d-flex column gap-075 ai-conversation-sidebar-header'>
                <SearchInput
                    placeholder='Search conversations...'
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />

                <Tooltip
                    content='You do not have permission to create conversations.'
                    disabled={canCreate}
                >
                    <SidebarNavItem
                        label='Chat'
                        icon={CiChat1}
                        onClick={createConversationClick}
                        disabled={!canCreate}
                    />
                </Tooltip>

                {error && (
                    <RecoveryState
                        title='Unable to load conversations'
                        description={error}
                        tone={RecoveryStateTone.Error}
                    />
                )}
            </div>

            <div className='volt-container d-flex column flex-1 y-auto ai-conversation-sidebar-list'>
                {listContent}
            </div>
        </div>
    );
};

export default AIConversationSidebar;
