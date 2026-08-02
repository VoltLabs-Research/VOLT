import { SOCKET_CHAT_EVENTS } from '@/modules/socket/events/chat';
import { emitOrSwallow } from '@/modules/socket/services/socket-emit-helpers';
import { useCallback, useEffect, useRef } from 'react';

const TYPING_TIMEOUT = 1000;

const useTypingIndicator = (chatId?: string | null) => {
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTypingRef = useRef(false);

    const stopTyping = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        if (!chatId || !isTypingRef.current) return;

        isTypingRef.current = false;
        emitOrSwallow(SOCKET_CHAT_EVENTS.TYPING_STOP, { chatId });
    }, [chatId]);

    const handleTyping = useCallback(() => {
        if (!chatId) return;

        if (!isTypingRef.current) {
            isTypingRef.current = true;
            emitOrSwallow(SOCKET_CHAT_EVENTS.TYPING_START, { chatId });
        }

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(stopTyping, TYPING_TIMEOUT);
    }, [chatId, stopTyping]);

    useEffect(() => stopTyping, [stopTyping]);

    return { handleTyping };
};

export default useTypingIndicator;
