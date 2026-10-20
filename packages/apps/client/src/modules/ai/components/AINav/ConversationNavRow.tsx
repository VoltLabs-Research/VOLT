import { confirm } from '@/shared/ui/hooks/use-confirm';
import { Tooltip, cn } from '@heroui/react';
import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';

import type { AIConversation } from '@volt/contracts/modules/ai/domain';
import type { KeyboardEvent, MouseEvent } from 'react';

interface ConversationNavRowProps {
    conversation: AIConversation;
    isActive: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    onSelect: (conversationId: string) => void;
    onRename: (conversationId: string, title: string) => Promise<void>;
    onDelete: (conversationId: string) => Promise<void>;
}

const ROW_ACTION_CLASS = 'inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50';

const ConversationNavRow = ({
    conversation,
    isActive,
    canUpdate,
    canDelete,
    onSelect,
    onRename,
    onDelete
}: ConversationNavRowProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [draftTitle, setDraftTitle] = useState('');

    const title = conversation.title || 'Untitled conversation';

    const finishEditing = async () => {
        const nextTitle = draftTitle.trim();
        setIsEditing(false);

        if (nextTitle && nextTitle !== conversation.title) {
            await onRename(conversation._id, nextTitle);
        }
    };

    const handleEditKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            finishEditing().catch(console.warn);
        }

        if (event.key === 'Escape') {
            setIsEditing(false);
        }
    };

    const handleDelete = async () => {
        const isConfirmed = await confirm({
            title: 'Delete this conversation?',
            confirmText: 'Delete'
        });

        if (isConfirmed) {
            await onDelete(conversation._id);
        }
    };

    if (isEditing) {
        return (
            <input
                className='h-8 w-full rounded-md border border-border bg-transparent px-2 text-sm text-foreground outline-none focus-visible:border-accent'
                value={draftTitle}
                autoFocus
                aria-label={`Rename ${title}`}
                onChange={(event) => setDraftTitle(event.target.value)}
                onBlur={() => { finishEditing().catch(console.warn); }}
                onKeyDown={handleEditKeyDown}
            />
        );
    }

    return (
        <div
            className={cn(
                'group/conv flex h-8 w-full min-w-0 cursor-pointer flex-row items-center gap-1 rounded-md px-2 text-sm transition-colors duration-150 ease-out-fluid',
                isActive ? 'bg-surface-hover font-medium text-foreground' : 'text-muted hover:text-foreground'
            )}
            role='button'
            tabIndex={0}
            onClick={() => onSelect(conversation._id)}
            onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(conversation._id);
                }
            }}
        >
            <span className='min-w-0 flex-1 truncate' title={title}>{title}</span>

            <span className={cn(
                'flex shrink-0 flex-row items-center gap-0.5 opacity-0 transition-opacity duration-150',
                'group-hover/conv:opacity-100 group-focus-within/conv:opacity-100 [@media(hover:none)]:opacity-100'
            )}>
                <Tooltip isDisabled={canUpdate}>
                    <Tooltip.Trigger<'button'>
                        render={(triggerProps) => <button type='button' {...triggerProps} />}
                        role={undefined}
                        className={ROW_ACTION_CLASS}
                        aria-label={`Rename ${title}`}
                        disabled={!canUpdate}
                        onClick={(event: MouseEvent<HTMLButtonElement>) => {
                            event.stopPropagation();
                            setDraftTitle(conversation.title);
                            setIsEditing(true);
                        }}
                    >
                        <Pencil size={12} />
                    </Tooltip.Trigger>
                    <Tooltip.Content>You do not have permission to rename conversations.</Tooltip.Content>
                </Tooltip>

                <Tooltip isDisabled={canDelete}>
                    <Tooltip.Trigger<'button'>
                        render={(triggerProps) => <button type='button' {...triggerProps} />}
                        role={undefined}
                        className={ROW_ACTION_CLASS}
                        aria-label={`Delete ${title}`}
                        disabled={!canDelete}
                        onClick={(event: MouseEvent<HTMLButtonElement>) => {
                            event.stopPropagation();
                            handleDelete().catch(console.warn);
                        }}
                    >
                        <Trash2 size={12} />
                    </Tooltip.Trigger>
                    <Tooltip.Content>You do not have permission to delete conversations.</Tooltip.Content>
                </Tooltip>
            </span>
        </div>
    );
};

export default ConversationNavRow;
