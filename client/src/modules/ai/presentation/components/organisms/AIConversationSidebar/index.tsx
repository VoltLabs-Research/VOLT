import { useMemo, useState } from 'react';
import { CiChat1 } from 'react-icons/ci';
import { IoPencilOutline, IoTrashOutline } from 'react-icons/io5';
import { formatDistanceToNow } from 'date-fns';
import type { AIConversation } from '@/modules/ai/domain/entities/AIConversation';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import IconButton from '@/shared/presentation/components/IconButton';
import Paragraph from '@/shared/presentation/components/Paragraph';
import SearchInput from '@/shared/presentation/components/SearchInput';
import SidebarNavItem from '@/shared/presentation/components/SidebarNavItem';
import { matchesQuery } from '@/shared/utils/matches-query';
import Tooltip from '@/shared/presentation/components/Tooltip';

interface AIConversationSidebarProps {
    conversations: AIConversation[];
    activeConversationId?: string;
    isLoading?: boolean;
    error?: string | null;
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
        if (!window.confirm('Delete this conversation?')) {
            return;
        }

        await onDeleteConversation(conversationId);
    };

    return (
        <Container className='d-flex column h-max ai-conversation-sidebar'>
            <Container className='d-flex column gap-075 ai-conversation-sidebar-header'>
                <SearchInput
                    placeholder='Search conversations...'
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                />

                <SidebarNavItem
                    label='Chat'
                    icon={CiChat1}
                    onClick={onCreateConversation}
                />

                {error && (
                    <Paragraph className='font-size-1 color-danger'>{error}</Paragraph>
                )}
            </Container>

            <Container className='d-flex column flex-1 y-auto ai-conversation-sidebar-list'>
                {isLoading ? (
                    Array.from({ length: 6 }).map((_, index) => (
                        <Container key={index} className='ai-conversation-item-skeleton' />
                    ))
                ) : filteredConversations.length === 0 ? (
                    <EmptyState
                        title='No conversations yet'
                        description={query ? 'No matching conversations found.' : 'Create a new chat to get started.'}
                    />
                ) : (
                    filteredConversations.map((conversation) => {
                        const isActive = conversation._id === activeConversationId;

                        return (
                            <Container
                                key={conversation._id}
                                className={`d-flex column gap-025 ai-conversation-item cursor-pointer ${isActive ? 'is-active' : ''}`}
                                onClick={() => onSelectConversation(conversation._id)}
                            >
                                <Container className='d-flex items-center content-between gap-05'>
                                    {editingConversationId === conversation._id ? (
                                        <input
                                            className='ai-conversation-title-input'
                                            value={draftTitle}
                                            autoFocus
                                            onChange={(event) => setDraftTitle(event.target.value)}
                                            onBlur={() => finishEditing().catch(() => {})}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    finishEditing().catch(() => {});
                                                }

                                                if (event.key === 'Escape') {
                                                    setEditingConversationId(null);
                                                    setDraftTitle('');
                                                }
                                            }}
                                            onClick={(event) => event.stopPropagation()}
                                        />
                                    ) : (
                                        <Paragraph className='font-size-2 font-weight-5 color-primary ai-conversation-title'>
                                            {conversation.title || 'Untitled conversation'}
                                        </Paragraph>
                                    )}

                                    <Container className='d-flex items-center gap-025 ai-conversation-item-actions'>
                                        <Tooltip content='Rename conversation'>
                                            <IconButton
                                                size='sm'
                                                variant='ghost'
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    beginEditing(conversation);
                                                }}
                                            >
                                                <IoPencilOutline size={14} />
                                            </IconButton>
                                        </Tooltip>

                                        <Tooltip content='Delete conversation'>
                                            <IconButton
                                                size='sm'
                                                variant='ghost'
                                                onClick={(event) => {
                                                    event.stopPropagation();
                                                    handleDeleteConversation(conversation._id).catch(() => {});
                                                }}
                                            >
                                                <IoTrashOutline size={14} />
                                            </IconButton>
                                        </Tooltip>
                                    </Container>
                                </Container>

                                <Paragraph className='font-size-1 color-muted'>
                                    {formatDistanceToNow(new Date(conversation.lastMessageAt || conversation.updatedAt), { addSuffix: true })}
                                </Paragraph>
                            </Container>
                        );
                    })
                )}
            </Container>
        </Container>
    );
};

export default AIConversationSidebar;
