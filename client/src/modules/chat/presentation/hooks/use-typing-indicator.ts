import { useCallback, useEffect, useRef } from 'react';
import useSocket from '@/modules/socket/presentation/hooks/use-socket';
import { CHAT_SOCKET_EVENTS } from '@/modules/chat/domain/constants';

const TYPING_TIMEOUT = 1000;

const useTypingIndicator = (chatId?: string) => {
    const socket = useSocket();
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTypingRef = useRef(false);

    const startTyping = useCallback(() => {
        if (!chatId || isTypingRef.current) return;
        
        isTypingRef.current = true;
        socket.emit(CHAT_SOCKET_EVENTS.TYPING_START, { chatId });
    }, [chatId, socket]);

    const stopTyping = useCallback(() => {
        if (!chatId || !isTypingRef.current) return;

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }

        isTypingRef.current = false;
        socket.emit(CHAT_SOCKET_EVENTS.TYPING_STOP, { chatId });
    }, [chatId, socket]);

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
            socket.emit(CHAT_SOCKET_EVENTS.TYPING_STOP, { chatId });
        };
    }, [chatId, socket]);

    return { handleTyping, stopTyping };
};

export default useTypingIndicator;
