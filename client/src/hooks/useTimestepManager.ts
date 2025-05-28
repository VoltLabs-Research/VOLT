import { useState, useEffect, useCallback, useRef } from 'react';
import { getTimesteps } from '../services/api';
import { useWebSocket } from './useWebSocket';
import type { FileInfo } from '../types';

interface TimestepData {
    timestep: number;
    atoms_count: number;
    positions: number[][];
    atom_types: number[];
    box_bounds: number[][] | null;
}

interface UseTimestepManagerReturn {
    timesteps: number[];
    currentTimestep: number;
    isPlaying: boolean;
    playSpeed: number;
    loading: boolean;
    error: string | null;
    timestepData: TimestepData | null;
    handleTimestepChange: (timestep: number) => void;
    handlePlayPause: () => void;
    handleSpeedChange: (speed: number) => void;
    // WebSocket específico
    preloadedData: Map<number, TimestepData>;
    isStreaming: boolean;
    streamProgress: { current: number; total: number } | null;
    startPreloading: () => void;
    stopPreloading: () => void;
    isConnected: boolean;
}

const useTimestepManager = (fileInfo: FileInfo | null): UseTimestepManagerReturn => {
    // Estados principales
    const [timesteps, setTimesteps] = useState<number[]>([]);
    const [currentTimestep, setCurrentTimestep] = useState<number>(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playSpeed, setPlaySpeed] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [timestepData, setTimestepData] = useState<TimestepData | null>(null);
    const [preloadedData, setPreloadedData] = useState<Map<number, TimestepData>>(new Map());
    
    // WebSocket hook
    const {
        isConnected,
        connectionError,
        startStream,
        stopStream,
        getTimestep,
        isStreaming,
        progress: streamProgress,
        receivedData,
        clearData,
        connectionInfo
    } = useWebSocket(fileInfo?.file_id || null);

    // Refs para control
    const animationRef = useRef<NodeJS.Timeout | null>(null);
    const hasStartedPreloadRef = useRef<boolean>(false);
    const currentFileIdRef = useRef<string | null>(null);

    // Cargar lista de timesteps usando HTTP solo para la lista inicial
    useEffect(() => {
        const loadTimesteps = async () => {
            if (!fileInfo) {
                setTimesteps([]);
                setCurrentTimestep(0);
                hasStartedPreloadRef.current = false;
                currentFileIdRef.current = null;
                return;
            }

            // Reset cuando cambia el archivo
            if (currentFileIdRef.current !== fileInfo.file_id) {
                setPreloadedData(new Map());
                setTimestepData(null);
                hasStartedPreloadRef.current = false;
                currentFileIdRef.current = fileInfo.file_id;
                clearData();
            }

            setLoading(true);
            setError(null);
            
            try {
                const data = await getTimesteps(fileInfo.file_id);
                setTimesteps(data.timesteps);
                
                if (data.timesteps.length > 0) {
                    setCurrentTimestep(data.timesteps[0]);
                }
            } catch (err: any) {
                setError(err.message || 'Error loading timesteps');
            } finally {
                setLoading(false);
            }
        };

        loadTimesteps();
    }, [fileInfo, clearData]);

    // INICIO AUTOMÁTICO DE PRELOAD cuando se conecta WebSocket
    useEffect(() => {
        const shouldStartPreload = (
            isConnected && 
            connectionInfo && 
            !hasStartedPreloadRef.current && 
            !isStreaming &&
            timesteps.length > 0
        );

        if (shouldStartPreload) {
            console.log('🚀 Starting automatic preload...');
            hasStartedPreloadRef.current = true;
            
            // Pequeño delay para asegurar que la conexión esté estable
            const timeoutId = setTimeout(() => {
                startStream({
                    includePositions: true,
                    batchSize: 30, // Lotes medianos para balance velocidad/estabilidad
                    delayMs: 50     // Delay moderado para no saturar
                });
            }, 100);

            return () => clearTimeout(timeoutId);
        }
    }, [isConnected, connectionInfo, isStreaming, timesteps.length, startStream]);

    // Actualizar datos pre-cargados cuando llegan por WebSocket
    useEffect(() => {
        if (receivedData.length > 0) {
            setPreloadedData(prevMap => {
                const newMap = new Map(prevMap);
                
                receivedData.forEach(data => {
                    if (!data.error) {
                        newMap.set(data.timestep, data);
                    }
                });
                
                return newMap;
            });
        }
    }, [receivedData]);

    // Detectar cuando llega el timestep actual por WebSocket
    useEffect(() => {
        if (receivedData.length > 0) {
            // Buscar el timestep actual en los datos recibidos
            const currentData = receivedData.find(data => 
                data.timestep === currentTimestep && !data.error
            );
            
            if (currentData) {
                setTimestepData(currentData);
                setLoading(false);
            }
        }
    }, [receivedData, currentTimestep]);

    // Función para obtener datos de un timestep específico
    const loadTimestepData = useCallback((timestep: number) => {
        if (!fileInfo || !isConnected) return;

        // Si tenemos los datos pre-cargados, usarlos inmediatamente
        if (preloadedData.has(timestep)) {
            const data = preloadedData.get(timestep)!;
            setTimestepData(data);
            setLoading(false);
            return;
        }

        // Si no están pre-cargados, pedir por WebSocket
        setLoading(true);
        getTimestep(timestep);
    }, [fileInfo, isConnected, preloadedData, getTimestep]);

    // Cargar datos cuando cambia el timestep actual
    useEffect(() => {
        if (currentTimestep > 0) {
            loadTimestepData(currentTimestep);
        }
    }, [currentTimestep, loadTimestepData]);

    // Funciones de control
    const handleTimestepChange = useCallback((timestep: number) => {
        setCurrentTimestep(timestep);
    }, []);

    const handlePlayPause = useCallback(() => {
        setIsPlaying(prev => !prev);
    }, []);

    const handleSpeedChange = useCallback((speed: number) => {
        setPlaySpeed(speed);
    }, []);

    // Animación optimizada para datos pre-cargados
    useEffect(() => {
        if (isPlaying && timesteps.length > 0 && isConnected) {
            // Velocidad adaptativa: más rápido si hay datos pre-cargados
            const baseInterval = preloadedData.size > timesteps.length * 0.5 ? 80 : 150;
            const interval = baseInterval / playSpeed;
            
            const animate = () => {
                setCurrentTimestep(current => {
                    const currentIndex = timesteps.indexOf(current);
                    const nextIndex = (currentIndex + 1) % timesteps.length;
                    return timesteps[nextIndex];
                });
            };

            animationRef.current = setTimeout(animate, interval);
        } else {
            if (animationRef.current) {
                clearTimeout(animationRef.current);
                animationRef.current = null;
            }
        }

        return () => {
            if (animationRef.current) {
                clearTimeout(animationRef.current);
            }
        };
    }, [isPlaying, timesteps, playSpeed, isConnected, preloadedData.size]);

    // Funciones de control manual de preload (por si se necesita reiniciar)
    const startPreloading = useCallback(() => {
        if (!isConnected) return;
        
        console.log('🔄 Manual preload restart...');
        clearData();
        setPreloadedData(new Map());
        hasStartedPreloadRef.current = true;
        
        startStream({
            includePositions: true,
            batchSize: 30,
            delayMs: 50
        });
    }, [isConnected, clearData, startStream]);

    const stopPreloading = useCallback(() => {
        console.log('⏸️ Stopping preload...');
        stopStream();
        hasStartedPreloadRef.current = false;
    }, [stopStream]);

    // Limpiar al cambiar de archivo
    useEffect(() => {
        if (!fileInfo) {
            setPreloadedData(new Map());
            setTimestepData(null);
            hasStartedPreloadRef.current = false;
            currentFileIdRef.current = null;
            clearData();
        }
    }, [fileInfo, clearData]);

    return {
        timesteps,
        currentTimestep,
        isPlaying,
        playSpeed,
        loading,
        error: error || connectionError,
        timestepData,
        handleTimestepChange,
        handlePlayPause,
        handleSpeedChange,
        preloadedData,
        isStreaming,
        streamProgress,
        startPreloading,
        stopPreloading,
        isConnected
    };
};

export default useTimestepManager;