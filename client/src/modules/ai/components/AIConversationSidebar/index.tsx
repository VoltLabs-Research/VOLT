import { matchesQuery } from '@/shared/utils/matches-query';
import { EmptyState, IconButton, SearchInput, Skeleton, Tooltip } from '@voltstack/bravais';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import SidebarNavItem from '@/shared/ui/components/SidebarNavItem';
import { confirm } from '@/shared/ui/hooks/use-confirm';
import { useMemo, useState } from 'react';
import { MessageCircle, Pencil, Trash2 } from 'lucide-react';
import type { AIConversation } from '@volt/contracts/modules/ai/domain';
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
}

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
            <p className='text-sm font-medium text-foreground ai-conversation-title'>
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
        const isEditing = editingConversationId === conversation._id;
        let itemClassName = 'flex flex-col gap-1 ai-conversation-item cursor-pointer';
        if (isActive) {
            itemClassName += ' is-active';
        }

        let renameTooltip = 'You do not have permission to rename conversations.';
        if (canUpdate) {
            renameTooltip = 'Rename conversation';
        }

        let deleteTooltip = 'You do not have permission to delete conversations.';
        if (canDelete) {
            deleteTooltip = 'Delete conversation';
        }

        const interactiveProps = isEditing
            ? {}
            : {
                role: 'button' as const,
                tabIndex: 0,
                onClick: () => onSelectConversation(conversation._id),
                onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectConversation(conversation._id);
                    }
                }
            };

        return (
            <div
                key={conversation._id}
                className={itemClassName}
                {...interactiveProps}
            >
                <div className='flex flex-row items-center justify-between gap-2'>
                    {renderConversationTitle(conversation)}

                    <div className='flex flex-row items-center gap-1 ai-conversation-item-actions'>
                        <Tooltip content={renameTooltip}>
                            <IconButton
                                aria-label={`Rename conversation ${conversation.title}`}
                                size='sm'
                                variant='ghost'
                                disabled={!canUpdate}
                                onClick={createRenameClickHandler(conversation)}
                            >
                                <Pencil size={14} />
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
                                <Trash2 size={14} />
                            </IconButton>
                        </Tooltip>
                    </div>
                </div>
            </div>
        );
    };

    let listContent: ReactNode = (
        <div className='flex flex-col gap-1'>
            {filteredConversations.map(renderConversationItem)}
        </div>
    );

    if (isLoading) {
        listContent = Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} variant='text' width='100%' height='3rem' />
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
        <div className='flex flex-col h-full ai-conversation-sidebar'>
            <div className='flex flex-col gap-3 ai-conversation-sidebar-header panel-header-bordered'>
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
                        icon={MessageCircle}
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

            <div className='flex flex-col overflow-y-auto flex-1 ai-conversation-sidebar-list'>
                {listContent}
            </div>
        </div>
    );
};

export default AIConversationSidebar;
