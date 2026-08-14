import ConversationNavRow from '@/modules/ai/components/AINav/ConversationNavRow';
import NavItem from '@/shared/ui/components/NavItem';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import SidebarPanel from '@/shared/ui/components/SidebarPanel';
import { useAIChatContext } from '@/modules/ai/providers/AIChatProvider';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { matchesQuery } from '@/shared/utils/matches-query';
import { SearchField, Skeleton, Tooltip } from '@heroui/react';
import { ArrowLeft, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import type { Params } from 'react-router-dom';
import type { ReactNode } from 'react';
import Scrollable from '@/shared/ui/components/Scrollable';

interface AINavRouteParams extends Params {
    conversationId?: string;
}

interface AINavProps {
    active: boolean;
    collapsed: boolean;
}

/* Below this the search field costs more room than it saves. */
const SEARCH_THRESHOLD = 8;

/*
 * The rail while /dashboard/ai is open: the conversation list takes over the left
 * column, exactly as Settings does, with "Go back" returning to the dashboard.
 *
 * It reads the chat context directly — `AIChatProvider` wraps the whole dashboard
 * layout, so the list and the thread share one source of conversations and can
 * never disagree about which one is active.
 */
const AINav = ({ active, collapsed }: AINavProps) => {
    const { conversationId } = useParams<AINavRouteParams>();
    const { canAccess } = useTeamPermissions();
    const [query, setQuery] = useState('');

    const {
        conversations,
        isConversationsLoading,
        conversationsError,
        handleSelectConversation,
        handleCreateConversation,
        handleDeleteConversation,
        handleRenameConversation
    } = useAIChatContext();

    const canCreate = canAccess(['ai-conversation:create']);
    const canUpdate = canAccess(['ai-conversation:update']);
    const canDelete = canAccess(['ai-conversation:delete']);

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
            onRename={handleRenameConversation}
            onDelete={handleDeleteConversation}
        />
    ));

    if (isConversationsLoading) {
        listContent = Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className='h-8 w-full rounded-md' aria-hidden='true' />
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
                        onClick={() => { handleCreateConversation().catch(console.warn); }}
                    />
                </Tooltip.Trigger>
                <Tooltip.Content placement='right'>
                    {canCreate ? 'New conversation' : 'You do not have permission to create conversations.'}
                </Tooltip.Content>
            </Tooltip>

            {/* The rail collapses to icons only, where a list of titles cannot be read. */}
            {!collapsed && (
                <div className='mt-2 flex min-h-0 flex-col gap-1'>
                    {showSearch && (
                        <SearchField
                            value={query}
                            onChange={setQuery}
                            aria-label='Search conversations'
                            fullWidth
                        >
                            <SearchField.Group>
                                <SearchField.SearchIcon />
                                <SearchField.Input placeholder='Search…' />
                                <SearchField.ClearButton />
                            </SearchField.Group>
                        </SearchField>
                    )}

                    <Scrollable className='flex min-h-0 flex-col gap-0.5'>
                        {listContent}
                    </Scrollable>
                </div>
            )}
        </SidebarPanel>
    );
};

export default AINav;
