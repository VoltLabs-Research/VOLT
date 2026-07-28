import { matchesQuery } from '@/shared/utils/matches-query';
import { EmptyState, IconButton, Row, SearchInput, Skeleton, Stack, Text, Tooltip } from '@voltstack/bravais';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import SidebarNavItem from '@/shared/ui/components/SidebarNavItem';
import { confirm } from '@/shared/ui/hooks/use-confirm';
import { useMemo, useState } from 'react';
import { CiChat1 } from 'react-icons/ci';
import { IoPencilOutline, IoTrashOutline } from 'react-icons/io5';
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
            <Text as='p' size='md' weight='medium' tone='primary' className='ai-conversation-title'>
                {conversation.title || 'Untitled conversation'}
            </Text>
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
                <Row justify='between' gap='05'>
                    {renderConversationTitle(conversation)}

                    <Row gap='025' className='ai-conversation-item-actions'>
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
                    </Row>
                </Row>
            </div>
        );
    };

    let listContent: ReactNode = (
        <Stack gap='025'>
            {filteredConversations.map(renderConversationItem)}
        </Stack>
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
        <Stack height='max' className='ai-conversation-sidebar'>
            <Stack gap='075' className='ai-conversation-sidebar-header panel-header-bordered'>
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
            </Stack>

            <Stack flex='1' overflow='y-auto' className='ai-conversation-sidebar-list'>
                {listContent}
            </Stack>
        </Stack>
    );
};

export default AIConversationSidebar;
