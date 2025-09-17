import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import useUrlState from '@/hooks/core/use-url-state';
import useRasterStore from '@/stores/raster';
import useTrajectoryStore from '@/stores/trajectories';
import useAnalysisConfigStore from '@/stores/analysis-config';
import { useStructureAnalysisStore } from '@/stores/structure-analysis';
import useAuthStore from '@/stores/authentication';
import useRasterFrame from '@/hooks/raster/use-raster-frame';
import useCacheCleanup from '@/hooks/raster/use-cache-cleanup';
import type { AnalysisSelectProps, MetricEntry, ModelRailProps, PlaybackControlsProps, Scene } from '@/types/raster';
import { formatSize } from '@/utilities/scene-utils';
import { IoTimeOutline, IoLayersOutline, IoBarChartOutline, IoAnalyticsOutline } from 'react-icons/io5';
import RasterHeader from '@/components/molecules/raster/RasterHeader';
import SceneColumn from '@/components/molecules/raster/SceneColumn';
import Thumbnails from '@/components/molecules/raster/Thumbnails';
import MetricsBar from '@/components/molecules/raster/MetricsBar';
import './HeadlessRasterizerView.css';

const HeadlessRasterizerView: React.FC = () => {
    const navigate = useNavigate();
    const { trajectoryId } = useParams<{ trajectoryId: string }>();
    const { updateUrlParams, getUrlParam } = useUrlState();

    const { trajectory, analyses, analysesNames, getRasterFrames, isLoading, preloadAllFrames, preloadPriorizedFrames, isPreloading, preloadProgress, resetPreloadState } = useRasterStore();
    const { getMetrics, trajectoryMetrics, isMetricsLoading } = useTrajectoryStore();
    const { getDislocationsByAnalysisId, analysisDislocationsById } = useAnalysisConfigStore();
    const { fetchStructureAnalysesByConfig } = useStructureAnalysisStore();
    
    useCacheCleanup();

    const [selectedAnalysisLeft, setSelectedAnalysisLeft] = useState<string | null>(null);
    const [selectedAnalysisRight, setSelectedAnalysisRight] = useState<string | null>(null);
    const [selectedModelLeft, setSelectedModelLeft] = useState('preview');
    const [selectedModelRight, setSelectedModelRight] = useState('preview');
    const [selectedFrameIndex, setSelectedFrameIndex] = useState(-1); // Inicialmente -1 para indicar que no se ha seleccionado frame
    const [isPlaying, setIsPlaying] = useState(false);
    const [showDislocations, setShowDislocations] = useState(false);
    const [showStructureAnalysis, setShowStructureAnalysis] = useState(false);

    const isInitializedRef = useRef(false);
    const timestepRestoredRef = useRef(false);
    const modelsFromUrlRef = useRef({ left: false, right: false });
    const lastPriorizedModelsRef = useRef<string | null>(null);

    const fetchedForIdRef = useRef<string | null>(null);
    const preloadInitiatedRef = useRef<string | null>(null);
    const getRasterFramesRef = useRef(getRasterFrames);
    const getMetricsRef = useRef(getMetrics);
    const preloadAllFramesRef = useRef(preloadAllFrames);
    const preloadPriorizedFramesRef = useRef(preloadPriorizedFrames);
    const urlUpdateTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        getRasterFramesRef.current = getRasterFrames;
        getMetricsRef.current = getMetrics;
        preloadAllFramesRef.current = preloadAllFrames;
        preloadPriorizedFramesRef.current = preloadPriorizedFrames;
    }, [getRasterFrames, getMetrics, preloadAllFrames, preloadPriorizedFrames]);

    // Efecto para limpiar el estado cuando se desmonta el componente
    useEffect(() => {
        return () => {
            if (trajectoryId) {
                resetPreloadState(trajectoryId);
                // Reiniciar el estado local de modelos priorizados
                lastPriorizedModelsRef.current = null;
            }
        };
    }, [trajectoryId, resetPreloadState]);

    useEffect(() => {
        if(!trajectoryId) return;
        if(fetchedForIdRef.current === trajectoryId) return;
        fetchedForIdRef.current = trajectoryId;

        getRasterFramesRef.current(trajectoryId);
        getMetricsRef.current(trajectoryId);
    }, [trajectoryId]);

    // Efecto para manejar la precarga inicial
    useEffect(() => {
        if(!trajectoryId || !analyses || Object.keys(analyses).length === 0) return;
        if(preloadInitiatedRef.current === trajectoryId) return;
        if(isLoading) return;

        console.log(`[HeadlessRasterizerView] Starting initial preload for trajectory ${trajectoryId}`);
        
        // Marcar que ya iniciamos la precarga para esta trayectoria
        preloadInitiatedRef.current = trajectoryId;
        
        // Obtener modelos prioritarios de los parámetros URL
        const urlModelLeft = getUrlParam('ml');
        const urlModelRight = getUrlParam('mr');
        
        const priorityModels: { ml?: string; mr?: string } = {};
        if (urlModelLeft) priorityModels.ml = urlModelLeft;
        if (urlModelRight) priorityModels.mr = urlModelRight;
        
        // Obtener timestep actual de la URL si existe
        const urlTimestep = getUrlParam('ts');
        const currentTimestep = urlTimestep ? parseInt(urlTimestep, 10) : undefined;
        
        // Registrar esta combinación de modelos como la precargada inicialmente
        // para evitar duplicación en el efecto de repriorización
        if (urlModelLeft || urlModelRight) {
            const initialModelKey = `${urlModelLeft || ''}-${urlModelRight || ''}`;
            lastPriorizedModelsRef.current = initialModelKey;
            console.log(`[HeadlessRasterizerView] Setting initial prioritized models: ${initialModelKey}`);
        }
        
        // Si hay modelos específicos en la URL, usar precarga priorizada
        if (urlModelLeft || urlModelRight) {
            console.log(`[HeadlessRasterizerView] Prioritizing URL models: ${JSON.stringify(priorityModels)}, timestep: ${currentTimestep}`);
            preloadPriorizedFramesRef.current(trajectoryId, priorityModels, currentTimestep);
        } else {
            console.log(`[HeadlessRasterizerView] No specific models in URL, using default preload`);
            preloadAllFramesRef.current(trajectoryId);
        }
        
    }, [trajectoryId, analyses, isLoading, getUrlParam]);



    const isValidNumber = (x: any): x is number => typeof x === "number" && Number.isFinite(x);

    const formatNumber = (n?: number): string => {
        if(!isValidNumber(n)) return '-';
        return new Intl.NumberFormat().format(n);
    };

    const findDislocationByTimestep = (dislocations: any[] | undefined, timestep: number | undefined): any => {
        if(!dislocations || !isValidNumber(timestep)) return undefined;
        return dislocations.find((dislocation) => {
            return isValidNumber(dislocation?.timestep) && dislocation.timestep === timestep;
        });
    };

    const safeParseInt = (value: string | null): number | null => {
        if(!value) return null;
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : null;
    };

    const resolveModelName = (desired: string | null, availableModels: string[]): string => {
        if(!desired) return 'preview';
        if(availableModels.includes(desired)) return desired;
        return availableModels[0];
    };

    const findClosestTimestepIndex = (targetTimestep: number, timeline: number[]): number => {
        if(timeline.length === 0) return 0;
        const exactIndex = timeline.indexOf(targetTimestep);
        if(exactIndex >= 0) return exactIndex;

        let closestIndex = 0;
        let closestDistance = Math.abs(timeline[0] - targetTimestep);
        for(let i = 1; i < timeline.length; i++){
            const distance = Math.abs(timeline[i] - targetTimestep);
            if(distance < closestDistance){
                closestDistance = distance;
                closestIndex = i;
            }
        }

        return closestIndex;
    };

    const timeline = useMemo(() => {
        if(!selectedAnalysisLeft && !selectedAnalysisRight) return [];
        
        // Cache parsed timesteps to avoid re-parsing
        const getTimesteps = (analysisId: string | null) => {
            if (!analysisId || !analyses?.[analysisId]?.frames) return [];
            return Object.keys(analyses[analysisId].frames)
                .map(ts => parseInt(ts, 10))
                .filter(isValidNumber)
                .sort((a, b) => a - b); // Sort immediately to avoid multiple sorts
        };
        
        const timestepsLeft = getTimesteps(selectedAnalysisLeft);
        const timestepsRight = getTimesteps(selectedAnalysisRight);

        if(timestepsLeft.length > 0 && timestepsRight.length > 0){
            const intersectionSet = new Set(timestepsLeft);
            const intersection = timestepsRight.filter((ts) => intersectionSet.has(ts));

            if(intersection.length > 0) return intersection; // Already sorted
            const unionSet = new Set([...timestepsLeft, ...timestepsRight]);
            return Array.from(unionSet).sort((a, b) => a - b);
        }

        return timestepsLeft.length > 0 ? timestepsLeft : timestepsRight;
    }, [selectedAnalysisLeft, selectedAnalysisRight, analyses]);

    const currentTimestep = selectedFrameIndex >= 0 ? timeline[selectedFrameIndex] : undefined;

    // Efecto para repriorizar la precarga cuando cambian los modelos seleccionados
    useEffect(() => {
        if (!trajectoryId || !analyses || Object.keys(analyses).length === 0) return;
        if (isLoading || isPreloading) return;
        if (!isInitializedRef.current) return; // Esperar a que se inicialicen los modelos
        
        // Solo repriorizar si los modelos son diferentes a 'preview' (que es el default)
        const hasSpecificModels = selectedModelLeft !== 'preview' || selectedModelRight !== 'preview';
        if (!hasSpecificModels) return;

        const priorityModels: { ml?: string; mr?: string } = {};
        if (selectedModelLeft && selectedModelLeft !== 'preview') {
            priorityModels.ml = selectedModelLeft;
        }
        if (selectedModelRight && selectedModelRight !== 'preview') {
            priorityModels.mr = selectedModelRight;
        }

        // Verificar si estos modelos coinciden con los que ya se precargaron desde la URL
        const urlModelLeft = getUrlParam('ml');
        const urlModelRight = getUrlParam('mr');
        
        const selectedModelsMatchUrl = 
            (urlModelLeft === selectedModelLeft || (!urlModelLeft && !selectedModelLeft)) && 
            (urlModelRight === selectedModelRight || (!urlModelRight && !selectedModelRight));
            
        if (selectedModelsMatchUrl) {
            console.log(`[HeadlessRasterizerView] Selected models match URL parameters, skipping repriorization`);
            return;
        }

        // En lugar de establecer un timeout, usamos un flag local para evitar repriorizaciones repetidas
        const modelKey = `${selectedModelLeft}-${selectedModelRight}`;
        if (lastPriorizedModelsRef.current === modelKey) {
            console.log(`[HeadlessRasterizerView] Models ${modelKey} already prioritized, skipping`);
            return; // Ya se priorizó esta combinación de modelos
        }
        
        // Registrar esta combinación de modelos como la última priorizada
        lastPriorizedModelsRef.current = modelKey;
        
        const tsForPreload = timeline[selectedFrameIndex];
        console.log(`[HeadlessRasterizerView] Prioritizing models: ${JSON.stringify(priorityModels)}, timestep: ${tsForPreload}`);
        preloadPriorizedFramesRef.current(trajectoryId, priorityModels, tsForPreload);
        
    }, [trajectoryId, analyses, selectedModelLeft, selectedModelRight, isLoading, isPreloading, timeline, selectedFrameIndex, getUrlParam]);

    const getAvailableModelsForFrame = useCallback((analysisId: string | null, timestep: number | undefined) => {
        // Si no tenemos un analysisId, no podemos obtener modelos
        if (!analysisId) {
            console.log(`[HeadlessRasterizerView] getAvailableModelsForFrame: No analysis ID provided`);
            return [];
        }
        
        if (!analyses || !analyses[analysisId]) {
            console.log(`[HeadlessRasterizerView] getAvailableModelsForFrame: Analysis not found for ID: ${analysisId}`);
            return [];
        }
        
        // Verificar si el análisis tiene la estructura de frames esperada
        if (!analyses[analysisId].frames) {
            console.log(`[HeadlessRasterizerView] getAvailableModelsForFrame: Analysis ${analysisId} has no frames property`);
            return [];
        }
        
        // Logging para depuración
        console.log(`[HeadlessRasterizerView] getAvailableModelsForFrame: Getting models for analysis: ${analysisId}, timestep: ${timestep}`);
        
        // Si timestep es undefined (cuando selectedFrameIndex = -1), intentamos obtener modelos del primer frame disponible
        if (timestep === undefined) {
            const availableFrames = Object.keys(analyses[analysisId].frames || {})
                .map(Number)
                .filter(isValidNumber)
                .sort((a, b) => a - b);
                
            // Si hay frames disponibles, usar el primero
            if (availableFrames.length > 0) {
                const firstFrame = availableFrames[0];
                console.log(`[HeadlessRasterizerView] getAvailableModelsForFrame: No timestep specified, using first available frame: ${firstFrame}`);
                
                // Asegurémonos de que el frame tiene la propiedad availableModels
                const models = analyses[analysisId].frames[firstFrame]?.availableModels || [];
                console.log(`[HeadlessRasterizerView] getAvailableModelsForFrame: Models for frame ${firstFrame}: ${JSON.stringify(models)}`);
                
                // Si no hay modelos disponibles para el primer frame, intentar buscar en todos los frames
                    if (models.length === 0) {
                        console.log(`[HeadlessRasterizerView] getAvailableModelsForFrame: No models for first frame, looking in all frames`);
                        const allModels = new Set<string>();
                        
                        for (const frame of availableFrames) {
                            const frameModels = analyses[analysisId].frames[frame]?.availableModels || [];
                            frameModels.forEach((model: string) => allModels.add(model));
                        }                    if (allModels.size > 0) {
                        const uniqueModels = Array.from(allModels);
                        console.log(`[HeadlessRasterizerView] getAvailableModelsForFrame: Found models across all frames: ${JSON.stringify(uniqueModels)}`);
                        return uniqueModels;
                    }
                }
                
                return models;
            }
            
            console.log(`[HeadlessRasterizerView] getAvailableModelsForFrame: No frames available for analysis ${analysisId}`);
            return [];
        }
        
        // Asegurémonos de que el timestep existe en este análisis
        if (!analyses[analysisId].frames[timestep]) {
            console.log(`[HeadlessRasterizerView] getAvailableModelsForFrame: Timestep ${timestep} not found in analysis ${analysisId}`);
            
            // Intentar encontrar el frame más cercano
            const availableFrames = Object.keys(analyses[analysisId].frames || {})
                .map(Number)
                .filter(isValidNumber)
                .sort((a, b) => a - b);
                
            if (availableFrames.length > 0) {
                // Encontrar el frame más cercano
                const closestFrame = availableFrames.reduce((prev, curr) => 
                    Math.abs(curr - (timestep || 0)) < Math.abs(prev - (timestep || 0)) ? curr : prev
                );
                
                console.log(`[HeadlessRasterizerView] getAvailableModelsForFrame: Using closest frame ${closestFrame} instead`);
                const models = analyses[analysisId].frames[closestFrame]?.availableModels || [];
                console.log(`[HeadlessRasterizerView] getAvailableModelsForFrame: Models for frame ${closestFrame}: ${JSON.stringify(models)}`);
                
                // Si no hay modelos disponibles para el frame más cercano, intentar buscar en todos los frames
                    if (models.length === 0) {
                        console.log(`[HeadlessRasterizerView] getAvailableModelsForFrame: No models for closest frame, looking in all frames`);
                        const allModels = new Set<string>();
                        
                        for (const frame of availableFrames) {
                            const frameModels = analyses[analysisId].frames[frame]?.availableModels || [];
                            frameModels.forEach((model: string) => allModels.add(model));
                        }                    if (allModels.size > 0) {
                        const uniqueModels = Array.from(allModels);
                        console.log(`[HeadlessRasterizerView] getAvailableModelsForFrame: Found models across all frames: ${JSON.stringify(uniqueModels)}`);
                        return uniqueModels;
                    }
                }
                
                return models;
            }
            
            return [];
        }
        
        // Caso normal: tenemos un timestep específico
        const models = analyses[analysisId].frames[timestep]?.availableModels || [];
        console.log(`[HeadlessRasterizerView] getAvailableModelsForFrame: Models for frame ${timestep}: ${JSON.stringify(models)}`);
        
        // Si no hay modelos disponibles para este frame específico, buscar en todos los frames
        if (models.length === 0) {
            console.log(`[HeadlessRasterizerView] getAvailableModelsForFrame: No models for timestep ${timestep}, looking in all frames`);
            const availableFrames = Object.keys(analyses[analysisId].frames || {})
                .map(Number)
                .filter(isValidNumber);
                
            const allModels = new Set<string>();
            
            for (const frame of availableFrames) {
                const frameModels = analyses[analysisId].frames[frame]?.availableModels || [];
                frameModels.forEach((model: string) => allModels.add(model));
            }
            
            if (allModels.size > 0) {
                const uniqueModels = Array.from(allModels);
                console.log(`[HeadlessRasterizerView] getAvailableModelsForFrame: Found models across all frames: ${JSON.stringify(uniqueModels)}`);
                return uniqueModels;
            }
        }
        
        return models;
    }, [analyses]);

    // Determinar si debemos mostrar las escenas o esperar a la restauración completa
    const shouldWaitForTimestepRestore = useMemo(() => {
        // Esperar a que se cargue el timeline
        if (!timeline.length) return true;
        
        // Esperar a que se inicialicen los análisis
        if (!isInitializedRef.current) return true;
        
        // Si hay análisis específicos en URL, esperar a que se configuren
        const urlAnalysisLeft = getUrlParam('al');
        const urlAnalysisRight = getUrlParam('ar');
        if ((urlAnalysisLeft && !selectedAnalysisLeft) || (urlAnalysisRight && !selectedAnalysisRight)) {
            return true;
        }
        
        return false;
    }, [timeline.length, getUrlParam, selectedAnalysisLeft, selectedAnalysisRight]);

    const availableModelsLeft = getAvailableModelsForFrame(selectedAnalysisLeft, currentTimestep);
    const availableModelsRight = getAvailableModelsForFrame(selectedAnalysisRight, currentTimestep);

    // Log para depuración de la escena izquierda
    useEffect(() => {
        console.log(`[HeadlessRasterizerView] DEBUG LEFT SCENE - Parameters for useRasterFrame:`, {
            trajectoryId,
            currentTimestep,
            selectedAnalysisLeft,
            selectedModelLeft,
            availableModelsLeft
        });
    }, [trajectoryId, currentTimestep, selectedAnalysisLeft, selectedModelLeft, availableModelsLeft]);

    // Solo crear las escenas si no estamos esperando la restauración del timestep
    const { scene: currentSceneLeft, isLoading: isLeftSceneLoading } = useRasterFrame(
        trajectoryId,
        currentTimestep,  // Siempre usar el currentTimestep actual
        selectedAnalysisLeft || undefined,
        selectedModelLeft
    );

    const { scene: currentSceneRight, isLoading: isRightSceneLoading } = useRasterFrame(
        trajectoryId,
        currentTimestep,  // Siempre usar el currentTimestep actual
        selectedAnalysisRight || undefined,
        selectedModelRight
    );

    // Log para depuración del estado de las escenas
    useEffect(() => {
        console.log(`[HeadlessRasterizerView] Scene States:`, {
            leftScene: {
                hasData: !!currentSceneLeft?.data,
                isLoading: isLeftSceneLoading,
                model: currentSceneLeft?.model,
                isUnavailable: currentSceneLeft?.isUnavailable
            },
            rightScene: {
                hasData: !!currentSceneRight?.data,
                isLoading: isRightSceneLoading,
                model: currentSceneRight?.model,
                isUnavailable: currentSceneRight?.isUnavailable
            }
        });
    }, [currentSceneLeft, currentSceneRight, isLeftSceneLoading, isRightSceneLoading]);

    const dislocationsLeft = selectedAnalysisLeft ? analysisDislocationsById?.[selectedAnalysisLeft] : undefined;
    const dislocationsRight = selectedAnalysisRight ? analysisDislocationsById?.[selectedAnalysisRight] : undefined;
    const dislocationDataLeft = findDislocationByTimestep(dislocationsLeft, currentTimestep);
    const dislocationDataRight = findDislocationByTimestep(dislocationsRight, currentTimestep);

    // Asegurarnos de que los datos estén sincronizados con el timestep actual
    useEffect(() => {
        if (currentTimestep === undefined || !showDislocations) return;
        
        console.log(`[HeadlessRasterizerView] Current timestep updated to ${currentTimestep}`);
        
        // Verificar si tenemos que cargar dislocaciones para el frame actual
        if (selectedAnalysisLeft && (!dislocationDataLeft || dislocationDataLeft.timestep !== currentTimestep)) {
            console.log(`[HeadlessRasterizerView] Loading dislocations for left analysis ${selectedAnalysisLeft}, timestep ${currentTimestep}`);
            getDislocationsByAnalysisId(selectedAnalysisLeft);
        }
        
        if (selectedAnalysisRight && (!dislocationDataRight || dislocationDataRight.timestep !== currentTimestep)) {
            console.log(`[HeadlessRasterizerView] Loading dislocations for right analysis ${selectedAnalysisRight}, timestep ${currentTimestep}`);
            getDislocationsByAnalysisId(selectedAnalysisRight);
        }
    }, [currentTimestep, selectedAnalysisLeft, selectedAnalysisRight, dislocationDataLeft, dislocationDataRight, showDislocations, getDislocationsByAnalysisId]);

    const isDislocationsLoadingLeft = showDislocations && !!selectedAnalysisLeft && (dislocationsLeft === undefined || !dislocationDataLeft);
    const isDislocationsLoadingRight = showDislocations && !!selectedAnalysisRight && (dislocationsRight === undefined || !dislocationDataRight);

    const metricEntries: MetricEntry[] = useMemo(() => {
        const metrics = trajectoryMetrics as any;
        const framesCount = metrics?.frames?.totalFrames;
        const totalSize = metrics?.files?.totalSizeBytes;
        const analysesCount = metrics?.structureAnalysis?.totalDocs;

        return [
            { key: "frames.totalFrames", label: "Frames", value: formatNumber(framesCount), icon: IoTimeOutline },
            { key: "files.totalSizeBytes", label: "Size", value: formatSize(totalSize), icon: IoLayersOutline },
            { key: "structureAnalysis.totalDocs", label: "Analyses", value: formatNumber(analysesCount), icon: IoBarChartOutline }
        ];
    }, [trajectoryMetrics]);

    useEffect(() => {
        if(isInitializedRef.current || !analysesNames?.length) return;
        
        // Obtener los parámetros URL para configuración inicial
        const urlAnalysisLeft = getUrlParam('al');
        const urlAnalysisRight = getUrlParam('ar');
        const urlModelLeft = getUrlParam('ml');
        const urlModelRight = getUrlParam('mr');
        const urlDislocations = getUrlParam('disl');
        const urlTimestep = getUrlParam('ts');
        const initialTimestep = urlTimestep ? parseInt(urlTimestep, 10) : undefined;

        console.log(`[HeadlessRasterizerView] Initializing from URL params:`, {
            urlAnalysisLeft,
            urlAnalysisRight,
            urlModelLeft,
            urlModelRight,
            urlTimestep: initialTimestep
        });
        
        // Crear un conjunto de IDs de análisis válidos
        const analysisIDs = new Set(analysesNames.map((a) => a._id));
        
        // Determinar análisis válidos: usar los de la URL si existen, sino usar los primeros disponibles
        const leftAnalysis = urlAnalysisLeft && analysisIDs.has(urlAnalysisLeft) 
            ? urlAnalysisLeft 
            : analysesNames[0]?._id || null;
            
        const rightAnalysis = urlAnalysisRight && analysisIDs.has(urlAnalysisRight) 
            ? urlAnalysisRight 
            : (analysesNames.length >= 2 ? analysesNames[1]._id : leftAnalysis);
        
        console.log(`[HeadlessRasterizerView] Selected analyses: leftAnalysis: ${leftAnalysis}, rightAnalysis: ${rightAnalysis}`);
        
        // IMPORTANTE: Establecer los análisis seleccionados primero, para que se actualicen antes de intentar
        // seleccionar modelos (que dependen de los análisis)
        if (leftAnalysis) {
            console.log(`[HeadlessRasterizerView] Setting left analysis: ${leftAnalysis}`);
            setSelectedAnalysisLeft(leftAnalysis);
        }
        
        if (rightAnalysis) {
            console.log(`[HeadlessRasterizerView] Setting right analysis: ${rightAnalysis}`);
            setSelectedAnalysisRight(rightAnalysis);
        }
        
        // En lugar de obtener los modelos inmediatamente, usamos un timeout
        // para asegurarnos de que los estados de análisis se hayan actualizado
        setTimeout(() => {
            // Obtener modelos disponibles para el timestep específico o el frame 0
            console.log(`[HeadlessRasterizerView] Getting available models for timestep: ${initialTimestep}`);
            
            const availableModelsForLeftAnalysis = leftAnalysis ? 
                getAvailableModelsForFrame(leftAnalysis, initialTimestep) : [];
            const availableModelsForRightAnalysis = rightAnalysis ? 
                getAvailableModelsForFrame(rightAnalysis, initialTimestep) : [];
                
            console.log(`[HeadlessRasterizerView] Available models - Left: ${JSON.stringify(availableModelsForLeftAnalysis)}, Right: ${JSON.stringify(availableModelsForRightAnalysis)}`);
            
            // Para el modelo izquierdo
            if (urlModelLeft) {
                if (availableModelsForLeftAnalysis.includes(urlModelLeft)) {
                    console.log(`[HeadlessRasterizerView] Setting left model from URL: ${urlModelLeft}`);
                    setSelectedModelLeft(urlModelLeft);
                    modelsFromUrlRef.current.left = true;
                } else {
                    const defaultModel = availableModelsForLeftAnalysis.length > 0 ? 
                        availableModelsForLeftAnalysis[0] : 'preview';
                    console.log(`[HeadlessRasterizerView] Model ${urlModelLeft} not available for left analysis, using ${defaultModel}`);
                    setSelectedModelLeft(defaultModel);
                }
            } else if (availableModelsForLeftAnalysis.length > 0) {
                console.log(`[HeadlessRasterizerView] No URL model for left, using first available: ${availableModelsForLeftAnalysis[0]}`);
                setSelectedModelLeft(availableModelsForLeftAnalysis[0]);
            } else {
                console.log(`[HeadlessRasterizerView] No models available for left analysis, using preview`);
                setSelectedModelLeft('preview');
            }
    
            // Para el modelo derecho
            if (urlModelRight) {
                if (availableModelsForRightAnalysis.includes(urlModelRight)) {
                    console.log(`[HeadlessRasterizerView] Setting right model from URL: ${urlModelRight}`);
                    setSelectedModelRight(urlModelRight);
                    modelsFromUrlRef.current.right = true;
                } else {
                    const defaultModel = availableModelsForRightAnalysis.length > 0 ? 
                        availableModelsForRightAnalysis[0] : 'preview';
                    console.log(`[HeadlessRasterizerView] Model ${urlModelRight} not available for right analysis, using ${defaultModel}`);
                    setSelectedModelRight(defaultModel);
                }
            } else if (availableModelsForRightAnalysis.length > 0) {
                console.log(`[HeadlessRasterizerView] No URL model for right, using first available: ${availableModelsForRightAnalysis[0]}`);
                setSelectedModelRight(availableModelsForRightAnalysis[0]);
            } else {
                console.log(`[HeadlessRasterizerView] No models available for right analysis, using preview`);
                setSelectedModelRight('preview');
            }
            
            // Configurar opciones adicionales
            if (urlDislocations === '1') {
                console.log(`[HeadlessRasterizerView] Enabling dislocations from URL`);
                setShowDislocations(true);
                
                // Cargar las dislocaciones inmediatamente 
                if (leftAnalysis) {
                    getDislocationsByAnalysisId(leftAnalysis);
                }
                if (rightAnalysis && rightAnalysis !== leftAnalysis) {
                    getDislocationsByAnalysisId(rightAnalysis);
                }
            }
            
            const urlStructureAnalysis = getUrlParam('sa');
            if (urlStructureAnalysis === '1') {
                console.log(`[HeadlessRasterizerView] Enabling structure analysis from URL`);
                setShowStructureAnalysis(true);
                
                // Precargar análisis de estructura
                if (leftAnalysis) {
                    fetchStructureAnalysesByConfig(leftAnalysis);
                }
                if (rightAnalysis && rightAnalysis !== leftAnalysis) {
                    fetchStructureAnalysesByConfig(rightAnalysis);
                }
            }
            
            // Marcar como inicializado solo después de establecer todo
            isInitializedRef.current = true;
            console.log(`[HeadlessRasterizerView] Initialization complete, isInitialized set to true`);
        }, 50); // Pequeño timeout para asegurar que los estados se actualicen correctamente
    }, [analysesNames, getUrlParam, getDislocationsByAnalysisId, getAvailableModelsForFrame, fetchStructureAnalysesByConfig]);

    // Handle timestep restoration separately when timeline is ready
    useEffect(() => {
        if (!isInitializedRef.current || timeline.length === 0) return;
        if (timestepRestoredRef.current) return; // Solo procesar una vez
        
        console.log(`[HeadlessRasterizerView] Timeline ready, restoring timestep. Timeline length: ${timeline.length}`);
        
        const urlTimestep = safeParseInt(getUrlParam('ts'));
        
        if (urlTimestep !== null) {
            console.log(`[HeadlessRasterizerView] Setting frame index for timestep from URL: ${urlTimestep}`);
            const targetIndex = findClosestTimestepIndex(urlTimestep, timeline);
            console.log(`[HeadlessRasterizerView] Target index: ${targetIndex}, Timeline length: ${timeline.length}, Target timestep: ${timeline[targetIndex]}`);
            
            // Marcar que estamos restaurando un timestep específico desde la URL
            setSelectedFrameIndex(targetIndex);
        } else if (selectedFrameIndex === -1 && timeline.length > 0) {
            // Si no hay timestep en URL y aún no se ha configurado un frame, seleccionar el primer frame
            console.log(`[HeadlessRasterizerView] No timestep in URL, setting to first frame in timeline: ${timeline[0]}`);
            setSelectedFrameIndex(0);
        }
        
        // Marcar como restaurado para evitar procesamiento múltiple
        timestepRestoredRef.current = true;
        
        // Esperar a que se seleccione el frame y luego validar que los modelos son correctos
        setTimeout(() => {
            console.log(`[HeadlessRasterizerView] After timestep selection, validating models`);
            // Obtener los modelos disponibles para el frame actual
            const urlTimestep = safeParseInt(getUrlParam('ts')) || timeline[0];
            
            // Validar modelo izquierdo
            if (selectedAnalysisLeft) {
                const leftModels = getAvailableModelsForFrame(selectedAnalysisLeft, urlTimestep);
                console.log(`[HeadlessRasterizerView] Available models for left (timestep ${urlTimestep}): ${JSON.stringify(leftModels)}`);
                
                if (!leftModels.includes(selectedModelLeft) && leftModels.length > 0) {
                    console.log(`[HeadlessRasterizerView] Selected left model ${selectedModelLeft} not valid for timestep ${urlTimestep}, using ${leftModels[0]}`);
                    setSelectedModelLeft(leftModels[0]);
                }
            }
            
            // Validar modelo derecho
            if (selectedAnalysisRight) {
                const rightModels = getAvailableModelsForFrame(selectedAnalysisRight, urlTimestep);
                console.log(`[HeadlessRasterizerView] Available models for right (timestep ${urlTimestep}): ${JSON.stringify(rightModels)}`);
                
                if (!rightModels.includes(selectedModelRight) && rightModels.length > 0) {
                    console.log(`[HeadlessRasterizerView] Selected right model ${selectedModelRight} not valid for timestep ${urlTimestep}, using ${rightModels[0]}`);
                    setSelectedModelRight(rightModels[0]);
                }
            }
        }, 100); // Pequeño timeout para asegurarnos de que el estado del frame se ha actualizado
        
    }, [timeline, getUrlParam, selectedFrameIndex, getAvailableModelsForFrame, selectedAnalysisLeft, selectedAnalysisRight, selectedModelLeft, selectedModelRight]);

    // Validate and correct model selections (skip if model came from URL)
    useEffect(() => {
        if(!isInitializedRef.current) return;
        
        if(availableModelsLeft.length === 0) return;
        
        const resolvedModel = resolveModelName(selectedModelLeft, availableModelsLeft);
        
        if(resolvedModel !== selectedModelLeft) {
            setSelectedModelLeft(resolvedModel);
            
            // Marcar que ya no se está utilizando el modelo de la URL si tuvo que ser cambiado
            if(modelsFromUrlRef.current.left) {
                modelsFromUrlRef.current.left = false;
            }
        }
    }, [availableModelsLeft, selectedModelLeft]);

    useEffect(() => {
        if(!isInitializedRef.current) return;
        
        if(availableModelsRight.length === 0) return;
        
        const resolvedModel = resolveModelName(selectedModelRight, availableModelsRight);

        if(resolvedModel !== selectedModelRight) {
            setSelectedModelRight(resolvedModel);
            
            // Marcar que ya no se está utilizando el modelo de la URL si tuvo que ser cambiado
            if(modelsFromUrlRef.current.right) {
                modelsFromUrlRef.current.right = false;
            }
        }
    }, [availableModelsRight, selectedModelRight]);

    // Update URL when state changes (but not during initial restoration) - debounced
    useEffect(() => {
        if(!isInitializedRef.current) return;
        
        if(urlUpdateTimeoutRef.current) {
            clearTimeout(urlUpdateTimeoutRef.current);
        }
        
        urlUpdateTimeoutRef.current = window.setTimeout(() => {
            const updates: Record<string, string | null> = {
                al: selectedAnalysisLeft,
                ar: selectedAnalysisRight,
                ml: selectedModelLeft,
                mr: selectedModelRight,
                disl: showDislocations ? "1" : null,
                sa: showStructureAnalysis ? "1" : null,
                ts: isValidNumber(currentTimestep) ? String(currentTimestep) : null
            };
            updateUrlParams(updates);
        }, isPlaying ? 500 : 100); // Longer debounce during autoplay
        
        return () => {
            if(urlUpdateTimeoutRef.current) {
                clearTimeout(urlUpdateTimeoutRef.current);
            }
        };
    }, [
        selectedAnalysisLeft,
        selectedAnalysisRight, 
        selectedModelLeft,
        selectedModelRight,
        showDislocations,
        showStructureAnalysis,
        currentTimestep,
        updateUrlParams,
        isPlaying
    ]);

    // Constrain frame index
    useEffect(() => {
        if(timeline.length === 0) return;
        const maxIndex = timeline.length - 1;
        if(selectedFrameIndex > maxIndex){
            setSelectedFrameIndex(maxIndex);
        }
    }, [timeline.length, selectedFrameIndex]);

    // Auto-play animation
    useEffect(() => {
        if(!isPlaying || timeline.length === 0) return;
        
        // Usamos un intervalo más largo para dar tiempo a cargar los frames
        const intervalId = setInterval(() => {
            setSelectedFrameIndex((prevIndex) => {
                // Avanzar al siguiente frame
                const nextIndex = (prevIndex + 1) % timeline.length;
                console.log(`Auto-play: Moving from frame ${prevIndex} (timestep ${timeline[prevIndex]}) to ${nextIndex} (timestep ${timeline[nextIndex]})`);
                return nextIndex;
            });
        }, 500); // Aumentamos el intervalo para dar más tiempo de carga
        
        return () => clearInterval(intervalId);
    }, [isPlaying, timeline.length]);

    // Keyboard controls
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if(e.ctrlKey && e.key === 'Enter'){
                e.preventDefault();
                setIsPlaying((prev) => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // Load dislocation data when needed - without debounce for immediate loading
    useEffect(() => {
        if(!selectedAnalysisLeft || !showDislocations) return;
        
        // Cargar dislocaciones inmediatamente, sin debounce
        getDislocationsByAnalysisId(selectedAnalysisLeft);
        
    }, [selectedAnalysisLeft, showDislocations, getDislocationsByAnalysisId]);

    useEffect(() => {
        if(!selectedAnalysisRight || !showDislocations) return;
        
        // Cargar dislocaciones inmediatamente, sin debounce
        getDislocationsByAnalysisId(selectedAnalysisRight);
        
    }, [selectedAnalysisRight, showDislocations, getDislocationsByAnalysisId]);
    
    // Efectos para cargar los datos de estructura cuando se selecciona un análisis
    useEffect(() => {
        if (!selectedAnalysisLeft || !showStructureAnalysis) return;
        
        // Cargar análisis estructurales inmediatamente usando el ID del análisis
        fetchStructureAnalysesByConfig(selectedAnalysisLeft);
        
    }, [selectedAnalysisLeft, showStructureAnalysis, fetchStructureAnalysesByConfig]);
    
    useEffect(() => {
        if (!selectedAnalysisRight || !showStructureAnalysis) return;
        
        // Cargar análisis estructurales inmediatamente usando el ID del análisis
        fetchStructureAnalysesByConfig(selectedAnalysisRight);
        
    }, [selectedAnalysisRight, showStructureAnalysis, fetchStructureAnalysesByConfig]);

    // Event handlers
    const handlePlayPause = useCallback(() => {
        setIsPlaying((prev) => !prev);
    }, []);

    const handleGoBack = useCallback(() => {
        navigate('/dashboard');
    }, [navigate]);

    const handleView3D = useCallback(() => {
        navigate(`/canvas/${trajectory._id}/`);
    }, [trajectory, navigate]);

    // Obtenemos el estado de autenticación
    const user = useAuthStore((state) => state.user);
    const isAuthenticated = !!user;

    const handleSignIn = useCallback(() => {
        navigate('/auth/sign-in');
    }, [navigate]);

    const handleThumbnailClick = useCallback((index: number) => {
        setSelectedFrameIndex(index);
    }, []);

    const handleToggleDislocations = useCallback(() => {
        setShowDislocations((prev) => !prev)
    }, []);
    
    const handleToggleStructureAnalysis = useCallback(() => {
        setShowStructureAnalysis((prev) => !prev)
    }, []);

    // Get thumbnail scene for a specific timestep
    const getThumbnailScene = useCallback((timestep: number): Scene | null => {
        if (!selectedAnalysisLeft && !selectedAnalysisRight) return null;
        
        const analysisId = selectedAnalysisLeft || selectedAnalysisRight;
        const model = selectedAnalysisLeft ? selectedModelLeft : selectedModelRight;
        
        // Verificar si este es el frame actualmente seleccionado
        const isSelectedFrame = timestep === currentTimestep;
        
        // Comprobamos si este frame ya está precargado en el análisis
        let isFrameLoading = true;
        if (analyses && analysisId && analyses[analysisId]?.frames?.[timestep]) {
            // Verificar si tenemos información sobre este frame
            const frameModels = analyses[analysisId].frames[timestep]?.availableModels || [];
            // Si el modelo actual está disponible para este frame, lo consideramos listo
            if (frameModels.includes(model)) {
                isFrameLoading = false;
            }
        }
        
        // Siempre forzar la carga del frame seleccionado
        if (isSelectedFrame) {
            console.log(`[HeadlessRasterizerView] Getting scene for selected frame ${timestep}`);
        }
        
        return {
            frame: timestep,
            model,
            analysisId: analysisId!,
            isLoading: isFrameLoading && !isSelectedFrame // No mostrar loading para el frame seleccionado
        };
    }, [selectedAnalysisLeft, selectedAnalysisRight, selectedModelLeft, selectedModelRight, analyses, currentTimestep]);

    const playbackControlsProps: PlaybackControlsProps = useMemo(() => ({ 
        isPlaying, 
        onPlayPause: handlePlayPause 
    }), [isPlaying, handlePlayPause]);

    const analysisSelectLeftProps: AnalysisSelectProps = useMemo(() => ({ 
        analysesNames: analysesNames || [], 
        selectedAnalysis: selectedAnalysisLeft, 
        onAnalysisChange: setSelectedAnalysisLeft, 
        isLoading 
    }), [analysesNames, selectedAnalysisLeft, isLoading]);

    const analysisSelectRightProps: AnalysisSelectProps = useMemo(() => ({ 
        analysesNames: analysesNames || [],
        selectedAnalysis: selectedAnalysisRight, 
        onAnalysisChange: setSelectedAnalysisRight, 
        isLoading 
    }), [analysesNames, selectedAnalysisRight, isLoading]);

    const modelRailLeftProps: ModelRailProps = useMemo(() => {
        // Si no hay análisis o modelo seleccionado, o no hay modelos disponibles, devolvemos una configuración vacía
        if (!selectedAnalysisLeft || !selectedModelLeft || availableModelsLeft.length === 0) {
            console.log(`[HeadlessRasterizerView] No models available for left rail`);
            return {
                modelsForCurrentFrame: [],
                selectedModel: "",
                onModelChange: setSelectedModelLeft
            };
        }

        return {
            modelsForCurrentFrame: availableModelsLeft.map((model: string) => ({
                frame: currentTimestep || 0, // Usar frame 0 como fallback
                model,
                analysisId: selectedAnalysisLeft
            })), 
            selectedModel: selectedModelLeft, 
            onModelChange: setSelectedModelLeft 
        };
    }, [availableModelsLeft, currentTimestep, selectedAnalysisLeft, selectedModelLeft]);

    const modelRailRightProps: ModelRailProps = useMemo(() => {
        // Si no hay análisis o modelo seleccionado, o no hay modelos disponibles, devolvemos una configuración vacía
        if (!selectedAnalysisRight || !selectedModelRight || availableModelsRight.length === 0) {
            console.log(`[HeadlessRasterizerView] No models available for right rail`);
            return {
                modelsForCurrentFrame: [],
                selectedModel: "",
                onModelChange: setSelectedModelRight
            };
        }

        return {
            modelsForCurrentFrame: availableModelsRight.map((model: string) => ({
                frame: currentTimestep || 0, // Usar frame 0 como fallback
                model,
                analysisId: selectedAnalysisRight
            })), 
            selectedModel: selectedModelRight, 
            onModelChange: setSelectedModelRight 
        };
    }, [availableModelsRight, currentTimestep, selectedAnalysisRight, selectedModelRight]);

    return (
        <main className='raster-view-container'>
                <RasterHeader
                    trajectory={trajectory}
                    isLoading={isLoading}
                    onGoBack={handleGoBack}
                    onView3D={handleView3D}
                    onSignIn={!user ? handleSignIn : undefined}
                />                        <div className='raster-scenes-container' style={{ position: 'relative' }}>
                {isPreloading && (
                    <div style={{
                        position: 'absolute',
                        top: '1rem',
                        right: '1rem',
                        zIndex: 10,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: '0.5rem 1rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.8rem',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <div style={{
                            width: '12px',
                            height: '12px',
                            border: '2px solid rgba(255, 255, 255, 0.3)',
                            borderTop: '2px solid white',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite'
                        }} />
                        Preloading frames: {preloadProgress}%
                    </div>
                )}
                
                <div className='raster-scenes-top-container' style={{ alignItems: 'stretch', gap: '0.75rem' }}>
                    <SceneColumn
                        trajectoryId={trajectory?._id}
                        scene={currentSceneLeft}
                        dislocationData={dislocationDataLeft}
                        isDislocationsLoading={isDislocationsLoadingLeft}
                        showDislocations={showDislocations}
                        isPlaying={isPlaying}
                        isLoading={isLoading || isLeftSceneLoading || (shouldWaitForTimestepRestore && !currentSceneLeft?.data)} 
                        playbackControls={playbackControlsProps}
                        analysisSelect={analysisSelectLeftProps}
                        modelRail={modelRailLeftProps}
                        showStructureAnalysis={showStructureAnalysis}
                        configId={selectedAnalysisLeft || undefined}
                        timestep={currentTimestep}
                        delay={0}
                    />

                    <SceneColumn
                        trajectoryId={trajectory?._id}
                        scene={currentSceneRight}
                        dislocationData={dislocationDataRight}
                        isDislocationsLoading={isDislocationsLoadingRight}
                        showDislocations={showDislocations}
                        isPlaying={isPlaying}
                        isLoading={isLoading || isRightSceneLoading || (shouldWaitForTimestepRestore && !currentSceneRight?.data)}
                        playbackControls={playbackControlsProps}
                        analysisSelect={analysisSelectRightProps}
                        modelRail={modelRailRightProps}
                        showStructureAnalysis={showStructureAnalysis}
                        configId={selectedAnalysisRight || undefined}
                        timestep={currentTimestep}
                        delay={0.1}
                    />
                </div>

                <Thumbnails
                    timeline={timeline}
                    selectedFrameIndex={selectedFrameIndex}
                    isPlaying={isPlaying}
                    isLoading={isLoading || shouldWaitForTimestepRestore}
                    onThumbnailClick={handleThumbnailClick}
                    getThumbnailScene={getThumbnailScene}
                />

                <MetricsBar 
                    items={metricEntries}
                    isLoading={isMetricsLoading}
                    showDislocations={showDislocations}
                    onToggleDislocations={handleToggleDislocations}
                    showStructureAnalysis={showStructureAnalysis}
                    onToggleStructureAnalysis={handleToggleStructureAnalysis}
                />
            </div>
        </main>
    );
};  

export default HeadlessRasterizerView;