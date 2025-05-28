import { useEffect, useRef, useCallback, useState } from 'react';

interface TimestepData {
    timestep: number;
    atoms_count: number;
    positions: number[][];
    atom_types: number[];
    box_bounds: number[][] | null;
    error?: string;
}

interface WebSocketMessage {
    type: string;
    file_id?: string;
    data?: any;
    error?: string;
    message?: string;
    timestep?: number;
    total_timesteps?: number;
    batch_index?: number;
    total_batches?: number;
    progress?: {
        current: number;
        total: number;
    };
}

interface UseWebSocketReturn {
    isConnected: boolean;
    connectionError: string | null;
    startStream: (options?: StreamOptions) => void;
    stopStream: () => void;
    getTimestep: (timestep: number) => void;
    isStreaming: boolean;
    progress: { current: number; total: number } | null;
    receivedData: TimestepData[];
    clearData: () => void;
    connectionInfo: any;
}

interface StreamOptions {
    includePositions?: boolean;
    batchSize?: number;
    delayMs?: number;
    startTimestep?: number;
    endTimestep?: number;
}

export const useWebSocket = (fileId: string | null): UseWebSocketReturn => {
    const wsRef = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [isStreaming, setIsStreaming] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
    const [receivedData, setReceivedData] = useState<TimestepData[]>([]);
    const [connectionInfo, setConnectionInfo] = useState<any>(null);
    
    // Refs para control de reconexión
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 5;

    const connect = useCallback(() => {
        if (!fileId || wsRef.current?.readyState === WebSocket.OPEN) return;

        try {
            const wsUrl = `ws://192.168.1.85:8000/ws/timesteps/${encodeURIComponent(fileId)}`;
            console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);
            
            wsRef.current = new WebSocket(wsUrl);

            wsRef.current.onopen = () => {
                setIsConnected(true);
                setConnectionError(null);
                reconnectAttemptsRef.current = 0;
                console.log('✅ WebSocket connected successfully');
            };

            wsRef.current.onmessage = (event) => {
                try {
                    const message: WebSocketMessage = JSON.parse(event.data);
                    
                    switch (message.type) {
                        case 'connection_established':
                            console.log('📡 Connection established:', message);
                            setConnectionInfo(message);
                            break;
                            
                        case 'stream_start':
                            console.log('🚀 Stream started:', message);
                            setIsStreaming(true);
                            setProgress({ current: 0, total: message.total_timesteps || 0 });
                            break;
                            
                        case 'timestep_batch':
                            const batchNum = (message.batch_index || 0) + 1;
                            const totalBatches = message.total_batches || 0;
                            console.log(`📦 Received batch ${batchNum}/${totalBatches} with ${message.data?.length || 0} timesteps`);
                            
                            if (message.data && Array.isArray(message.data)) {
                                setReceivedData(prev => {
                                    // Agregar solo timesteps válidos (sin error)
                                    const validData = message.data.filter(item => !item.error);
                                    return [...prev, ...validData];
                                });
                                setProgress(message.progress || null);
                            }
                            break;
                            
                        case 'stream_complete':
                            console.log('✅ Stream completed successfully');
                            setIsStreaming(false);
                            break;
                            
                        case 'stream_stopped':
                            console.log('⏹️ Stream stopped');
                            setIsStreaming(false);
                            break;
                            
                        case 'single_timestep':
                            console.log(`📄 Received single timestep: ${message.timestep}`);
                            if (message.data && message.timestep) {
                                const newTimestepData: TimestepData = {
                                    timestep: message.timestep,
                                    atoms_count: message.data.atoms_count,
                                    positions: message.data.positions,
                                    atom_types: message.data.atom_types,
                                    box_bounds: message.data.box_bounds
                                };
                                
                                setReceivedData(prev => {
                                    const filtered = prev.filter(item => item.timestep !== message.timestep);
                                    return [...filtered, newTimestepData];
                                });
                            }
                            break;
                            
                        case 'error':
                        case 'stream_error':
                            console.error('❌ WebSocket error:', message.error || message.message);
                            setConnectionError(message.error || message.message || 'Unknown error');
                            setIsStreaming(false);
                            break;
                            
                        default:
                            console.log('❓ Unknown message type:', message.type);
                    }
                } catch (error) {
                    console.error('💥 Error parsing WebSocket message:', error);
                    setConnectionError('Error parsing server response');
                }
            };

            wsRef.current.onclose = (event) => {
                setIsConnected(false);
                setIsStreaming(false);
                console.log('🔌 WebSocket disconnected:', event.code, event.reason);
                
                // Intentar reconexión automática si no fue cierre intencional
                if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
                    const reconnectDelay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
                    console.log(`🔄 Attempting reconnection in ${reconnectDelay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
                    
                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttemptsRef.current++;
                        connect();
                    }, reconnectDelay);
                }
            };

            wsRef.current.onerror = (error) => {
                console.error('💥 WebSocket error:', error);
                setConnectionError('WebSocket connection error');
                setIsConnected(false);
                setIsStreaming(false);
            };

        } catch (error) {
            console.error('💥 Failed to create WebSocket:', error);
            setConnectionError('Failed to create WebSocket connection');
        }
    }, [fileId]);

    const disconnect = useCallback(() => {
        console.log('🔌 Disconnecting WebSocket...');
        
        // Limpiar timeout de reconexión
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        
        if (wsRef.current) {
            wsRef.current.close(1000, 'Client disconnecting');
            wsRef.current = null;
        }
        setIsConnected(false);
        setIsStreaming(false);
        setConnectionInfo(null);
        reconnectAttemptsRef.current = 0;
    }, []);

    const sendMessage = useCallback((message: any) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(message));
            return true;
        }
        console.warn('⚠️ WebSocket not connected, cannot send message');
        return false;
    }, []);

    const startStream = useCallback((options: StreamOptions = {}) => {
        const command = {
            type: 'start_stream',
            include_positions: options.includePositions ?? true,
            batch_size: options.batchSize ?? 30,
            delay_ms: options.delayMs ?? 50,
            start_timestep: options.startTimestep,
            end_timestep: options.endTimestep
        };

        if (sendMessage(command)) {
            console.log('📤 Stream start command sent:', command);
        } else {
            console.error('❌ Failed to send stream start command');
        }
    }, [sendMessage]);

    const stopStream = useCallback(() => {
        if (sendMessage({ type: 'stop_stream' })) {
            console.log('📤 Stream stop command sent');
        }
    }, [sendMessage]);

    const getTimestep = useCallback((timestep: number) => {
        if (sendMessage({ type: 'get_timestep', timestep })) {
            console.log(`📤 Single timestep request sent: ${timestep}`);
        }
    }, [sendMessage]);

    const clearData = useCallback(() => {
        setReceivedData([]);
        setProgress(null);
        setConnectionError(null);
    }, []);

    useEffect(() => {
        if (fileId) {
            connect();
        } else {
            disconnect();
        }

        return () => {
            disconnect();
        };
    }, [fileId, connect, disconnect]);

    return {
        isConnected,
        connectionError,
        startStream,
        stopStream,
        getTimestep,
        isStreaming,
        progress,
        receivedData,
        clearData,
        connectionInfo
    };
};