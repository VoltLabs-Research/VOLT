import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import useUrlState from '@/hooks/core/use-url-state';
import useRasterStore from '@/stores/raster';
import useTrajectoryStore from '@/stores/trajectories';
import useAnalysisConfigStore from '@/stores/analysis-config';
import useRasterFrame from '@/hooks/raster/use-raster-frame';
import useCacheCleanup from '@/hooks/raster/use-cache-cleanup';
import type { AnalysisSelectProps, MetricEntry, ModelRailProps, PlaybackControlsProps, Scene } from '@/types/raster';
import { formatSize } from '@/utilities/scene-utils';
import { IoTimeOutline, IoLayersOutline, IoBarChartOutline } from 'react-icons/io5';
import RasterHeader from '@/components/molecules/raster/RasterHeader';
import SceneColumn from '@/components/molecules/raster/SceneColumn';
import Thumbnails from '@/components/molecules/raster/Thumbnails';
import MetricsBar from '@/components/molecules/raster/MetricsBar';
import './HeadlessRasterizerView.css';

const HeadlessRasterizerView: React.FC = () => {
    const navigate = useNavigate();
    const { trajectoryId } = useParams<{ trajectoryId: string }>();
    const { updateUrlParams, getUrlParam } = useUrlState();

    const { trajectory, analyses, analysesNames, getRasterFrames, isLoading, preloadAllFrames, preloadPriorizedFrames, isPreloading, preloadProgress } = useRasterStore();
    const { getMetrics, trajectoryMetrics, isMetricsLoading } = useTrajectoryStore();
    const { getDislocationsByAnalysisId, analysisDislocationsById } = useAnalysisConfigStore();
    
    useCacheCleanup();

    const [selectedAnalysisLeft, setSelectedAnalysisLeft] = useState<string | null>(null);
    const [selectedAnalysisRight, setSelectedAnalysisRight] = useState<string | null>(null);
    const [selectedModelLeft, setSelectedModelLeft] = useState('preview');
    const [selectedModelRight, setSelectedModelRight] = useState('preview');
    const [selectedFrameIndex, setSelectedFrameIndex] = useState(-1); // Inicialmente -1 para indicar que no se ha seleccionado frame
    const [isPlaying, setIsPlaying] = useState(false);
    const [showDislocations, setShowDislocations] = useState(false);

    const isInitializedRef = useRef(false);
    const timestepRestoredRef = useRef(false);
    const modelsFromUrlRef = useRef({ left: false, right: false });

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

    useEffect(() => {
        if(!trajectoryId) return;
        if(fetchedForIdRef.current === trajectoryId) return;
        fetchedForIdRef.current = trajectoryId;

        getRasterFramesRef.current(trajectoryId);
        getMetricsRef.current(trajectoryId);
    }, [trajectoryId]);

    useEffect(() => {
        if(!trajectoryId || !analyses || Object.keys(analyses).length === 0) return;
        if(preloadInitiatedRef.current === trajectoryId) return;
        if(isLoading) return;

        preloadInitiatedRef.current = trajectoryId;
        
        // Obtener modelos prioritarios de los parámetros URL
        const urlModelLeft = getUrlParam('ml');
        const urlModelRight = getUrlParam('mr');
        
        const priorityModels: { ml?: string; mr?: string } = {};
        if (urlModelLeft) priorityModels.ml = urlModelLeft;
        if (urlModelRight) priorityModels.mr = urlModelRight;
        
        // Obtener timestep actual de la URL si existe - eliminar el timeout
        const urlTimestep = getUrlParam('ts');
        const currentTimestep = urlTimestep ? parseInt(urlTimestep, 10) : undefined;
        
        // Si hay modelos específicos en la URL, usar precarga priorizada
        if (urlModelLeft || urlModelRight) {
            // Cargar inmediatamente, sin timeout
            preloadPriorizedFramesRef.current(trajectoryId, priorityModels, currentTimestep);
        } else {
            // Fallback a precarga normal
            preloadAllFramesRef.current(trajectoryId);
        }
        
    }, [trajectoryId, analyses, isLoading, getUrlParam]);

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

        // Pequeño delay para evitar múltiples llamadas
        const timeoutId = setTimeout(() => {
            const currentTimestep = timeline[selectedFrameIndex];
            preloadPriorizedFramesRef.current(trajectoryId, priorityModels, currentTimestep);
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [trajectoryId, analyses, selectedModelLeft, selectedModelRight, isLoading, isPreloading]);

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

    const getAvailableModelsForFrame = useCallback((analysisId: string | null, timestep: number | undefined) => {
        // Si no tenemos un analysisId, no podemos obtener modelos
        if(!analysisId || !analyses?.[analysisId]) return [];
        
        // Si timestep es undefined (cuando selectedFrameIndex = -1), intentamos obtener modelos del frame 0
        // Si no hay timestep específico, buscar el primer frame disponible
        if(timestep === undefined) {
            const availableFrames = Object.keys(analyses[analysisId].frames || {})
                .map(Number)
                .sort((a, b) => a - b);
                
            // Si hay frames disponibles, usar el primero (generalmente 0)
            if(availableFrames.length > 0) {
                const firstFrame = availableFrames[0];
                console.log(`[HeadlessRasterizerView] No timestep specified, using first available frame: ${firstFrame}`);
                return analyses[analysisId].frames[firstFrame].availableModels || [];
            }
            return [];
        }
        
        // Caso normal: tenemos un timestep específico
        return analyses[analysisId].frames?.[timestep]?.availableModels || [];
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

    // Solo crear las escenas si no estamos esperando la restauración del timestep
    const { scene: currentSceneLeft } = useRasterFrame(
        trajectoryId,
        currentTimestep,  // Siempre usar el currentTimestep actual
        selectedAnalysisLeft || undefined,
        selectedModelLeft
    );

    const { scene: currentSceneRight } = useRasterFrame(
        trajectoryId,
        currentTimestep,  // Siempre usar el currentTimestep actual
        selectedAnalysisRight || undefined,
        selectedModelRight
    );

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
        
        const urlAnalysisLeft = getUrlParam('al');
        const urlAnalysisRight = getUrlParam('ar');

        const urlModelleft = getUrlParam('ml');
        const urlModelRight = getUrlParam('mr');

        const urlDislocations = getUrlParam('disl');

        const analysisIDs = new Set(analysesNames.map((a) => a._id));
        const leftAnalysis = urlAnalysisLeft && analysisIDs.has(urlAnalysisLeft) ? urlAnalysisLeft : analysesNames[0]?._id || null;
        const rightAnalysis = urlAnalysisRight && analysisIDs.has(urlAnalysisRight) ? urlAnalysisRight : (analysesNames.length >= 2 ? analysesNames[1]._id : leftAnalysis);
        setSelectedAnalysisLeft(leftAnalysis);
        setSelectedAnalysisRight(rightAnalysis);
        
        if(urlModelleft){
            setSelectedModelLeft(urlModelleft);
            modelsFromUrlRef.current.left = true;
        }

        if(urlModelRight){
            setSelectedModelRight(urlModelRight);
            modelsFromUrlRef.current.right = true;
        }

        if(urlDislocations === '1'){
            setShowDislocations(true);
        }
        
        // Cargar las dislocaciones inmediatamente si están en la URL
        if (urlDislocations === '1' && leftAnalysis) {
            getDislocationsByAnalysisId(leftAnalysis);
        }
        
        if (urlDislocations === '1' && rightAnalysis && rightAnalysis !== leftAnalysis) {
            getDislocationsByAnalysisId(rightAnalysis);
        }

        isInitializedRef.current = true;
    }, [analysesNames, getUrlParam, getDislocationsByAnalysisId]);

    // Handle timestep restoration separately when timeline is ready
    useEffect(() => {
        if(!isInitializedRef.current || timeline.length === 0) return;
        if(timestepRestoredRef.current) return; // Solo procesar una vez
        
        const urlTimestep = safeParseInt(getUrlParam('ts'));
        
        if(urlTimestep !== null){
            console.log("[HeadlessRasterizerView] Setting frame index for timestep:", urlTimestep);
            const targetIndex = findClosestTimestepIndex(urlTimestep, timeline);
            console.log("[HeadlessRasterizerView] Target index:", targetIndex, "Timeline length:", timeline.length, "Target timestep:", timeline[targetIndex]);
            
            // Marcar que estamos restaurando un timestep específico desde la URL
            setSelectedFrameIndex(targetIndex);
        } else if(selectedFrameIndex === -1 && timeline.length > 0) {
            // Si no hay timestep en URL y aún no se ha configurado un frame, seleccionar el primer frame
            // pero no el frame 0 por defecto
            console.log("[HeadlessRasterizerView] No timestep in URL, setting to first frame in timeline");
            setSelectedFrameIndex(0);
        }
        
        // Marcar como restaurado inmediatamente para no bloquear la carga
        timestepRestoredRef.current = true;
        
    }, [timeline, getUrlParam, selectedFrameIndex]);

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

    const handleSignIn = useCallback(() => {
        navigate('/auth/sign-in');
    }, [navigate]);

    const handleThumbnailClick = useCallback((index: number) => {
        setSelectedFrameIndex(index);
    }, []);

    const handleToggleDislocations = useCallback(() => {
        setShowDislocations((prev) => !prev)
    }, []);

    // Get thumbnail scene for a specific timestep
    const getThumbnailScene = useCallback((timestep: number): Scene | null => {
        if (!selectedAnalysisLeft && !selectedAnalysisRight) return null;
        
        const analysisId = selectedAnalysisLeft || selectedAnalysisRight;
        const model = selectedAnalysisLeft ? selectedModelLeft : selectedModelRight;
        
        return {
            frame: timestep,
            model,
            analysisId: analysisId!,
            isLoading: true
        };
    }, [selectedAnalysisLeft, selectedAnalysisRight, selectedModelLeft, selectedModelRight]);

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
                onSignIn={handleSignIn}
            />

                        <div className='raster-scenes-container' style={{ position: 'relative' }}>
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
                        scene={currentSceneLeft}
                        dislocationData={dislocationDataLeft}
                        isDislocationsLoading={isDislocationsLoadingLeft}
                        showDislocations={showDislocations}
                        isPlaying={isPlaying}
                        isLoading={isLoading && (!currentSceneLeft || !currentSceneLeft.data)} 
                        playbackControls={playbackControlsProps}
                        analysisSelect={analysisSelectLeftProps}
                        modelRail={modelRailLeftProps}
                        delay={0}
                    />

                    <SceneColumn
                        scene={currentSceneRight}
                        dislocationData={dislocationDataRight}
                        isDislocationsLoading={isDislocationsLoadingRight}
                        showDislocations={showDislocations}
                        isPlaying={isPlaying}
                        isLoading={isLoading && (!currentSceneRight || !currentSceneRight.data)}
                        playbackControls={playbackControlsProps}
                        analysisSelect={analysisSelectRightProps}
                        modelRail={modelRailRightProps}
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
                />
            </div>
        </main>
    );
};  

export default HeadlessRasterizerView;