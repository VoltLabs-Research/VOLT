import { SocketConnectionStatus } from '@/modules/socket/core/socket-connection-status';
import useSocketConnectionStatus from './use-socket-connection-status';
import { useEffect, useRef } from 'react';
import { sileo } from 'sileo';

const useSocketConnectionToast = (): void => {
    const connectionStatus = useSocketConnectionStatus();
    const toastIdRef = useRef<string | null>(null);
    const previousStatusRef = useRef<SocketConnectionStatus | null>(null);

    useEffect(() => {
        const dismissActiveToast = () => {
            if(toastIdRef.current){
                sileo.dismiss(toastIdRef.current);
                toastIdRef.current = null;
            }
        };

        if (connectionStatus === SocketConnectionStatus.Connected) {
            dismissActiveToast();

            if (
                previousStatusRef.current === SocketConnectionStatus.Reconnecting
                || previousStatusRef.current === SocketConnectionStatus.Error
            ) {
                sileo.success({ title: 'Reconnected to server' });
            }
        }

        if (connectionStatus === SocketConnectionStatus.Connecting) {
            dismissActiveToast();
            toastIdRef.current = sileo.show({
                type: 'loading',
                title: 'Establishing connection...',
                duration: null
            });
        }

        if (connectionStatus === SocketConnectionStatus.Reconnecting) {
            dismissActiveToast();
            toastIdRef.current = sileo.show({
                type: 'loading',
                title: 'Connection lost. Reconnecting...',
                duration: null
            });
        }

        if (connectionStatus === SocketConnectionStatus.Error) {
            dismissActiveToast();
            toastIdRef.current = sileo.show({
                type: 'error',
                title: 'Unable to connect to server',
                duration: 5000
            });
        }

        if (connectionStatus === SocketConnectionStatus.Disconnected) {
            dismissActiveToast();
        }

        previousStatusRef.current = connectionStatus;

        return () => {
            if (connectionStatus !== SocketConnectionStatus.Connected) {
                dismissActiveToast();
            }
        };
    }, [connectionStatus]);
};

export default useSocketConnectionToast;
