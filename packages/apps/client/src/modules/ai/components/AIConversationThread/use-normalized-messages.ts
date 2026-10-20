import { groupAssistantRuns, normalizeMessageGroup, signMessageGroup } from '@/modules/ai/utils/message-segments';
import { useMemo, useRef } from 'react';
import type { NormalizedConversationMessage } from '@/modules/ai/utils/message-segments';
import type { UIMessage } from 'ai';

interface NormalizedMessageCacheEntry {
    signature: string;
    value: NormalizedConversationMessage;
}

const useNormalizedMessages = (messages: UIMessage[]): NormalizedConversationMessage[] => {
    const cacheRef = useRef(new Map<string, NormalizedMessageCacheEntry>());

    return useMemo(() => {
        const cache = cacheRef.current;
        const nextCache = new Map<string, NormalizedMessageCacheEntry>();

        const normalized = groupAssistantRuns(messages).map((group) => {
            const key = group[0].id;
            const signature = signMessageGroup(group);
            const cached = cache.get(key);
            const value = cached?.signature === signature ? cached.value : normalizeMessageGroup(group);

            nextCache.set(key, {
                signature,
                value
            });

            return value;
        });

        cacheRef.current = nextCache;
        return normalized;
    }, [messages]);
};

export default useNormalizedMessages;
