import { SOCKET_CHAT_EVENTS } from '@/modules/socket/events/chat';
import { emitOrSwallow } from '@/modules/socket/services/socket-emit-helpers';
import { useCallback, useEffect, useRef } from 'react';

const TYPING_TIMEOUT = 1000;

const useTypingIndicator = (chatId?: string) => {
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTypingRef = useRef(false);

    const startTyping = useCallback(() => {
        if (!chatId || isTypingRef.current) return;

        isTypingRef.current = true;
        emitOrSwallow(SOCKET_CHAT_EVENTS.TYPING_START, { chatId });
    }, [chatId]);

    const stopTyping = useCallback(() => {
        if (!chatId || !isTypingRef.current) return;

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        isTypingRef.current = false;
        emitOrSwallow(SOCKET_CHAT_EVENTS.TYPING_STOP, { chatId });
    }, [chatId]);

    const handleTyping = useCallback(() => {
        if (!chatId) return;

        startTyping();

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            stopTyping();
        }, TYPING_TIMEOUT);
    }, [chatId, startTyping, stopTyping]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }

            if (!chatId || !isTypingRef.current) {
                return;
            }

            isTypingRef.current = false;
            emitOrSwallow(SOCKET_CHAT_EVENTS.TYPING_STOP, { chatId });
        };
    }, [chatId]);

    return { handleTyping };
};

export default useTypingIndicator;
