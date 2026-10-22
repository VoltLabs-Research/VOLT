import { useCallback, useEffect, useState } from 'react';
import { messagesWindowQuery } from '@/modules/ai/hooks/queries';
import { chatHub } from '@/modules/ai/store/chat-hub';
import { mergeMessages, toUIMessage } from '@/modules/ai/utils/transcript';
import { ErrorSurface } from '@/shared/contracts/errors';
import { reportError } from '@/shared/errors/core/report-error';
import type { ChatSession } from '@/modules/ai/hooks/use-chat-session';

const WINDOW_SIZE = 40;

export interface Transcript {
    loading: boolean;
    error: Error | null;
    hasEarlier: boolean;
    loadingEarlier: boolean;
    loadEarlier: () => void;
    reload: () => void;
}

// How far back the reader has gone. Page 1 alone reads hasMore from the observed latest window.
interface Reach {
    conversationId: string;
    page: number;
    hasMore: boolean;
    loading: boolean;
}

const startOf = (conversationId: string): Reach => ({
    conversationId,
    page: 1,
    hasMore: false,
    loading: false
});

// The server pages newest first, so page 1 is the end of the conversation. It stays observed, to be
// refetched when a rejoin missed a stored reply; earlier windows are fetched once and merged into
// what the session already shows, never replacing it.
const useTranscript = (teamId: string, conversationId: string, session: Pick<ChatSession, 'setMessages'>): Transcript => {
    const { setMessages } = session;
    const [reach, setReach] = useState(() => startOf(conversationId));
    if (reach.conversationId !== conversationId) setReach(startOf(conversationId));

    const reached = reach.conversationId === conversationId ? reach : startOf(conversationId);
    const windowAt = useCallback((page: number) => ({
        teamId,
        conversationId,
        page,
        limit: WINDOW_SIZE
    }), [teamId, conversationId]);

    const latest = messagesWindowQuery(windowAt(1), {
        staleTime: 0,
        gcTime: 0,
        refetchOnWindowFocus: false
    });

    useEffect(() => {
        const loaded = latest.data;
        if (loaded === undefined) return;

        setMessages((current) => mergeMessages(current, loaded.data.map(toUIMessage)));
        chatHub.ready(conversationId);
    }, [conversationId, latest.data, setMessages]);

    // A transcript that failed to load still lets a live turn show what it says.
    useEffect(() => {
        if (latest.error !== null) chatHub.ready(conversationId);
    }, [conversationId, latest.error]);

    // Merged whether or not it changed: the copy on screen may hold parts of a turn cut off by the
    // lost connection, which the stored copy drops and the resumed replay streams again.
    const { refetch } = latest;
    useEffect(() => chatHub.onReconcile((reconciled) => {
        if (reconciled !== conversationId) return;

        void refetch().then(({ data }) => {
            if (data !== undefined) setMessages((current) => mergeMessages(current, data.data.map(toUIMessage)));
            chatHub.ready(conversationId);
        });
    }), [conversationId, refetch, setMessages]);

    const hasEarlier = reached.page === 1 ? latest.data?.pagination.hasMore === true : reached.hasMore;

    const loadEarlier = (): void => {
        if (!hasEarlier || reached.loading) return;

        const page = reached.page + 1;
        const ownReach = (update: (current: Reach) => Reach) => setReach((current) => (
            current.conversationId === conversationId ? update(current) : current
        ));

        ownReach((current) => ({
            ...current,
            loading: true
        }));
        messagesWindowQuery.fetch(windowAt(page), {
            staleTime: 0,
            gcTime: 0
        }).then((loaded) => {
            setMessages((current) => mergeMessages(current, loaded.data.map(toUIMessage)));
            ownReach(() => ({
                conversationId,
                page,
                hasMore: loaded.pagination.hasMore,
                loading: false
            }));
        }).catch((error: unknown) => {
            ownReach((current) => ({
                ...current,
                loading: false
            }));
            reportError(error, {
                surface: ErrorSurface.Toast,
                fallbackTitle: 'Failed to load earlier messages'
            });
        });
    };

    return {
        loading: latest.isLoading,
        error: latest.error,
        hasEarlier,
        loadingEarlier: reached.loading,
        loadEarlier,
        reload: () => {
            setReach(startOf(conversationId));
            void latest.refetch();
        }
    };
};

export default useTranscript;
