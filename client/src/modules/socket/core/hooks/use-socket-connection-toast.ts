import useSocket from './use-socket';
import { useEffect, useRef } from 'react';
import { sileo } from 'sileo';

const useSocketConnectionToast = (): void => {
    const socketService = useSocket();
    const toastIdRef = useRef<string | null>(null);
    const hasConnectedOnceRef = useRef(false);

    useEffect(() => {
        const dismissActiveToast = () => {
            if(toastIdRef.current){
                sileo.dismiss(toastIdRef.current);
                toastIdRef.current = null;
            }
        };

        if(!socketService.isConnected()){
            toastIdRef.current = sileo.show({
                type: 'loading',
                title: 'Establishing connection...',
                duration: null
            });
        }else{
            hasConnectedOnceRef.current = true;
        }

        const unsubscribe = socketService.onConnectionChange((connected) => {
            if(connected){
                dismissActiveToast();
                if(hasConnectedOnceRef.current){
                    sileo.success({ title: 'Reconnected to server' });
                }
                hasConnectedOnceRef.current = true;
            }else{
                dismissActiveToast();
                toastIdRef.current = sileo.show({
                    type: 'loading',
                    title: 'Connection lost. Reconnecting...',
                    duration: null
                });
            }
        });

        return () => {
            unsubscribe();
            dismissActiveToast();
        };
    }, [socketService]);
};

export default useSocketConnectionToast;
