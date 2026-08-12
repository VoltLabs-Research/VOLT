import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { confirm } from '@/shared/ui/hooks/use-confirm';
import { Button, SearchField, Skeleton, Tooltip, cn } from '@heroui/react';
import { useMemo, useState } from 'react';
import { MessageCircle, Pencil, Trash2 } from 'lucide-react';
import { matchesQuery } from '@/shared/utils/matches-query';
import type { AIConversation } from '@volt/contracts/modules/ai/domain';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';

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

    const renderConversationTitle = (conversation: AIConversation) => {
        let content: ReactNode = (
            <p className='truncate text-sm font-medium text-foreground'>
                {conversation.title || 'Untitled conversation'}
            </p>
        );

        if (editingConversationId === conversation._id) {
            content = (
                <input
                    className='w-full rounded-lg border border-border bg-transparent px-2 py-1 text-foreground'
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
                className={cn('group/conv flex w-full cursor-pointer appearance-none flex-col gap-1 rounded-xl border-0 bg-transparent px-3 py-2.5 text-left transition-colors duration-200 hover:bg-surface-hover focus-visible:bg-surface-hover', isActive && 'is-active bg-surface-hover')}
                {...interactiveProps}
            >
                <div className='flex flex-row items-center justify-between gap-2'>
                    {renderConversationTitle(conversation)}

                    <div className={cn('flex flex-row items-center gap-1 opacity-0 transition-opacity duration-200 group-hover/conv:opacity-100 group-focus-within/conv:opacity-100', isActive && 'opacity-100')}>
                        <Tooltip>
                            <Tooltip.Trigger<'button'>
                                render={(triggerProps) => <button type='button' {...triggerProps} />}
                                role={undefined}
                                className='inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50'
                                aria-label={`Rename conversation ${conversation.title}`}
                                disabled={!canUpdate}
                                onClick={(event: MouseEvent<HTMLButtonElement>) => {
                                    event.stopPropagation();
                                    beginEditing(conversation);
                                }}
                            >
                                <Pencil size={14} />
                            </Tooltip.Trigger>
                            <Tooltip.Content>{renameTooltip}</Tooltip.Content>
                        </Tooltip>
                        <Tooltip>
                            <Tooltip.Trigger<'button'>
                                render={(triggerProps) => <button type='button' {...triggerProps} />}
                                role={undefined}
                                className='inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50'
                                aria-label={`Delete conversation ${conversation.title}`}
                                disabled={!canDelete}
                                onClick={(event: MouseEvent<HTMLButtonElement>) => {
                                    event.stopPropagation();
                                    handleDeleteConversation(conversation._id).catch(console.warn);
                                }}
                            >
                                <Trash2 size={14} />
                            </Tooltip.Trigger>
                            <Tooltip.Content>{deleteTooltip}</Tooltip.Content>
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
            <Skeleton key={index} className='h-12 w-full rounded-md' />
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
            <RecoveryState
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
        <div className='flex h-full w-[300px] flex-col overflow-hidden border-r border-border max-lg:w-[270px] max-md:max-h-[42vh] max-md:w-full'>
            <div className='flex flex-col gap-3'>
                <SearchField
                    value={query}
                    onChange={setQuery}
                    aria-label='Search conversations'
                    fullWidth
                >
                    <SearchField.Group>
                        <SearchField.SearchIcon />
                        <SearchField.Input placeholder='Search conversations...' />
                        <SearchField.ClearButton />
                    </SearchField.Group>
                </SearchField>
                <Tooltip isDisabled={canCreate}>
                    <Tooltip.Trigger className='w-full' role='presentation' tabIndex={-1}>
                        <Button
                            variant='ghost'
                            className='flex min-h-12 w-full cursor-pointer items-center justify-start gap-3 rounded-lg border border-transparent px-3.5 py-2.5 text-left text-sm font-normal text-muted transition-colors duration-150 ease-out-fluid hover:bg-surface-hover hover:text-foreground focus-visible:bg-surface-hover focus-visible:text-foreground'
                            onPress={createConversationClick}
                            isDisabled={!canCreate}
                        >
                            <MessageCircle className='mx-0 my-0 size-5 shrink-0' aria-hidden='true' />
                            <span className='flex-1'>Chat</span>
                        </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content>You do not have permission to create conversations.</Tooltip.Content>
                </Tooltip>

                {error && (
                    <RecoveryState
                        title='Unable to load conversations'
                        description={error}
                        tone={RecoveryStateTone.Error}
                    />
                )}
            </div>
            <div className='flex flex-1 flex-col gap-1.5 overflow-y-auto p-2'>
                {listContent}
            </div>
        </div>
    );
};

export default AIConversationSidebar;
