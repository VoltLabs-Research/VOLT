import { useEffect, useRef, useState, useCallback } from 'react';

type WebSocketStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

interface UseWebSocketOptions {
    url: string;
    autoConnect?: boolean;
    onMessage?: (message: MessageEvent<any>) => void;
    onOpen?: () => void;
    onClose?: () => void;
    onError?: (error: Event) => void;
}

const useWebSocket = ({
    url,
    autoConnect = true,
    onMessage,
    onOpen,
    onClose,
    onError
}: UseWebSocketOptions) => {
    const socketRef = useRef<WebSocket | null>(null);
    const [status, setStatus] = useState<WebSocketStatus>('idle');

    const connect = () => {
        if(socketRef.current && socketRef.current.readyState === WebSocket.OPEN) return;

        const ws = new WebSocket(url);
        socketRef.current = ws;
        setStatus('connecting');

        ws.onopen = () => {
            console.log(`OpenDXA [DEBUG]: Connected to the WebSocket ${url}.`)
            setStatus('open');
            onOpen?.();
        };

        ws.onmessage = (event) => {
            console.log(`OpenDXA [DEBUG]: "onmessage" event in "useWebSocket" hook.`)
            onMessage?.(event);
        };

        ws.onerror = (event) => {
            console.log(`OpenDXA [DEBUG]: "onerror" event in "useWebSocket" hook.`)
            setStatus('error');
            onError?.(event);
        };

        ws.onclose = () => {
            console.log(`OpenDXA [DEBUG]: "onclose" event in "useWebSocket" hook.`)
            setStatus('closed');
            onClose?.();
        };
    };

    const sendMessage = useCallback((data: any) => {
        if(socketRef.current && socketRef.current.readyState === WebSocket.OPEN){
            socketRef.current.send(typeof data === 'string' ? data : JSON.stringify(data))
            return;
        }

        console.warn('OpenDXA: WebSocket is not open. Cannot send message.')
    }, []);

    const disconnect = useCallback(() => {
        socketRef.current?.close();
        socketRef.current = null;
        setStatus('closed');
    }, []);

    useEffect(() => {
        if(autoConnect) connect();
        return () => {
            disconnect();
        };
    }, []);

    return {
        status,
        connect,
        disconnect,
        sendMessage,
        isConnected: status === 'open'
    };
};

export default useWebSocket;