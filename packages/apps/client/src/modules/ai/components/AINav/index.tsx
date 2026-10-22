import ConversationNavRow from '@/modules/ai/components/AINav/ConversationNavRow';
import NavItem from '@/shared/ui/components/NavItem';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import SidebarPanel, { SidebarPanelTitle } from '@/shared/ui/components/SidebarPanel';
import useConversations from '@/modules/ai/hooks/use-conversations';
import { useChatSurfaceStore } from '@/modules/ai/store/use-chat-surface-store';
import { resolveErrorTitle } from '@/shared/errors/core/report-error';
import { SearchField, Skeleton, Tooltip } from '@heroui/react';
import { ArrowLeft, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import type { AIConversation } from '@volt/contracts/modules/ai/domain';
import type { Params } from 'react-router-dom';
import type { ReactNode } from 'react';
import Scrollable from '@/shared/ui/components/Scrollable';

const matchesQuery = (value: string, query: string): boolean => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
        return true;
    }

    return value.toLowerCase().includes(normalizedQuery);
};

interface AINavRouteParams extends Params {
    conversationId?: string;
}

interface AINavProps {
    active: boolean;
    collapsed: boolean;
}

const SEARCH_THRESHOLD = 8;

const AINav = ({ active, collapsed }: AINavProps) => {
    const { conversationId } = useParams<AINavRouteParams>();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const setActive = useChatSurfaceStore((state) => state.setActive);

    const {
        conversations,
        isLoading: isConversationsLoading,
        error,
        canCreate,
        canUpdate,
        canDelete,
        renameConversation,
        deleteConversation
    } = useConversations();
    const conversationsError = error ? resolveErrorTitle(error, 'Failed to load conversations.') : null;

    // The AI page follows its route and hands the conversation to the floating panel itself.
    const handleSelectConversation = (conversation: AIConversation) => {
        if (conversation._id !== conversationId) navigate(`/dashboard/ai/${conversation._id}`);
    };

    const handleCreateConversation = () => {
        if (conversationId) navigate('/dashboard/ai');
    };

    const handleDeleteConversation = async (conversation: AIConversation) => {
        await deleteConversation(conversation);

        if (conversation._id === conversationId) navigate('/dashboard/ai');
        else if (useChatSurfaceStore.getState().active?.conversationId === conversation._id) setActive(null);
    };

    const filteredConversations = useMemo(
        () => conversations.filter((conversation) => matchesQuery(conversation.title, query)),
        [conversations, query]
    );

    const showSearch = conversations.length >= SEARCH_THRESHOLD;

    let listContent: ReactNode = filteredConversations.map((conversation) => (
        <ConversationNavRow
            key={conversation._id}
            conversation={conversation}
            isActive={conversation._id === conversationId}
            canUpdate={canUpdate}
            canDelete={canDelete}
            onSelect={handleSelectConversation}
            onRename={renameConversation}
            onDelete={handleDeleteConversation}
        />
    ));

    if (isConversationsLoading) {
        listContent = Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className='h-11 w-full rounded-md lg:h-8' aria-hidden='true' />
        ));
    } else if (conversationsError) {
        listContent = (
            <RecoveryState
                title='Unable to load conversations'
                description={conversationsError}
                tone={RecoveryStateTone.Error}
            />
        );
    } else if (filteredConversations.length === 0) {
        listContent = (
            <p className='px-2 py-3 text-xs text-muted'>
                {query ? 'No conversations match.' : 'No conversations yet.'}
            </p>
        );
    }

    return (
        <SidebarPanel name='ai' label='AI conversations' active={active}>
            <Tooltip isDisabled={!collapsed}>
                <Tooltip.Trigger className='w-full' role='presentation' tabIndex={-1}>
                    <NavItem label='Go back' icon={ArrowLeft} to='/dashboard' collapsed={collapsed} />
                </Tooltip.Trigger>
                <Tooltip.Content placement='right'>Go back</Tooltip.Content>
            </Tooltip>

            <Tooltip isDisabled={!collapsed && canCreate}>
                <Tooltip.Trigger className='w-full' role='presentation' tabIndex={-1}>
                    <NavItem
                        label='New conversation'
                        icon={Plus}
                        collapsed={collapsed}
                        isDisabled={!canCreate}
                        onClick={handleCreateConversation}
                    />
                </Tooltip.Trigger>
                <Tooltip.Content placement='right'>
                    {canCreate ? 'New conversation' : 'You do not have permission to create conversations.'}
                </Tooltip.Content>
            </Tooltip>

            {!collapsed && (
                <div className='flex min-h-0 flex-col'>
                    {showSearch && (
                        <SearchField
                            value={query}
                            onChange={setQuery}
                            aria-label='Search conversations'
                            variant='secondary'
                            fullWidth
                            className='mt-1'
                        >
                            <SearchField.Group className='rounded-full border-0 bg-foreground/5 hover:bg-foreground/8 focus-within:bg-foreground/8'>
                                <SearchField.SearchIcon />
                                <SearchField.Input placeholder='Search…' />
                                <SearchField.ClearButton />
                            </SearchField.Group>
                        </SearchField>
                    )}

                    <SidebarPanelTitle>Recent</SidebarPanelTitle>

                    <Scrollable className='flex min-h-0 flex-col gap-0.5'>
                        {listContent}
                    </Scrollable>
                </div>
            )}
        </SidebarPanel>
    );
};

export default AINav;
