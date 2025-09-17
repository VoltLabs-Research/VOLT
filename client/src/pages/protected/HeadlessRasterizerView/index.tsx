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

    const { trajectory, analyses, analysesNames, getRasterFrames, isLoading, preloadAllFrames, isPreloading, preloadProgress } = useRasterStore();
    const { getMetrics, trajectoryMetrics, isMetricsLoading } = useTrajectoryStore();
    const { getDislocationsByAnalysisId, analysisDislocationsById } = useAnalysisConfigStore();
    
    useCacheCleanup();

    const [selectedAnalysisLeft, setSelectedAnalysisLeft] = useState<string | null>(null);
    const [selectedAnalysisRight, setSelectedAnalysisRight] = useState<string | null>(null);
    const [selectedModelLeft, setSelectedModelLeft] = useState('preview');
    const [selectedModelRight, setSelectedModelRight] = useState('preview');
    const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);
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
    const urlUpdateTimeoutRef = useRef<number | null>(null);

    useEffect(() => {
        getRasterFramesRef.current = getRasterFrames;
        getMetricsRef.current = getMetrics;
        preloadAllFramesRef.current = preloadAllFrames;
    }, [getRasterFrames, getMetrics, preloadAllFrames]);

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
        
        setTimeout(() => {
            preloadAllFramesRef.current(trajectoryId);
        }, 1000);
    }, [trajectoryId, analyses, isLoading]);

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

    const currentTimestep = timeline[selectedFrameIndex];

    const getAvailableModelsForFrame = useCallback((analysisId: string | null, timestep: number | undefined) => {
        if(!analysisId || !timestep || !analyses?.[analysisId]?.frames?.[timestep]) return [];
        return analyses[analysisId].frames[timestep].availableModels || [];
    }, [analyses]);

    const availableModelsLeft = getAvailableModelsForFrame(selectedAnalysisLeft, currentTimestep);
    const availableModelsRight = getAvailableModelsForFrame(selectedAnalysisRight, currentTimestep);

    const { scene: currentSceneLeft } = useRasterFrame(
        trajectoryId,
        currentTimestep,
        selectedAnalysisLeft || undefined,
        selectedModelLeft
    );

    const { scene: currentSceneRight } = useRasterFrame(
        trajectoryId,
        currentTimestep,
        selectedAnalysisRight || undefined,
        selectedModelRight
    );

    const dislocationsLeft = selectedAnalysisLeft ? analysisDislocationsById?.[selectedAnalysisLeft] : undefined;
    const dislocationsRight = selectedAnalysisRight ? analysisDislocationsById?.[selectedAnalysisRight] : undefined;
    const dislocationDataLeft = findDislocationByTimestep(dislocationsLeft, currentTimestep);
    const dislocationDataRight = findDislocationByTimestep(dislocationsRight, currentTimestep);

    const isDislocationsLoadingLeft = showDislocations && !!selectedAnalysisLeft && dislocationsLeft === undefined;
    const isDislocationsLoadingRight = showDislocations && !!selectedAnalysisRight && dislocationsRight === undefined;

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

        isInitializedRef.current = true;
    }, [analysesNames, getUrlParam]);

    // Handle timestep restoration separately when timeline is ready
    useEffect(() => {
        if(!isInitializedRef.current || timeline.length === 0 || timestepRestoredRef.current) return;
        const urlTimestep = safeParseInt(getUrlParam('ts'));

        if(urlTimestep !== null){
            const targetIndex = findClosestTimestepIndex(urlTimestep, timeline);
            setSelectedFrameIndex(targetIndex);
            timestepRestoredRef.current = true;
        }
    }, [timeline, getUrlParam]);

    // Validate and correct model selections (skip if model came from URL)
    useEffect(() => {
        if(!isInitializedRef.current || modelsFromUrlRef.current.left) return;
        const resolvedModel = resolveModelName(selectedModelLeft, availableModelsLeft);
        
        if(resolvedModel !== selectedModelLeft){
            setSelectedModelLeft(resolvedModel);
        }
    }, [availableModelsLeft, selectedModelLeft]);

    useEffect(() => {
        if(!isInitializedRef.current || modelsFromUrlRef.current.right) return;
        const resolvedModel = resolveModelName(selectedModelRight, availableModelsRight);

        if(resolvedModel !== selectedModelRight){
            setSelectedModelRight(resolvedModel);
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
        const intervalId = setInterval(() => {
            setSelectedFrameIndex((prevIndex) => (prevIndex + 1) % timeline.length);
        }, 300);
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

    // Load dislocation data when needed - with debounce to avoid rapid requests
    useEffect(() => {
        if(!selectedAnalysisLeft || !showDislocations) return;
        
        const timeoutId = setTimeout(() => {
            getDislocationsByAnalysisId(selectedAnalysisLeft);
        }, 200);
        
        return () => clearTimeout(timeoutId);
    }, [selectedAnalysisLeft, showDislocations, getDislocationsByAnalysisId]);

    useEffect(() => {
        if(!selectedAnalysisRight || !showDislocations) return;
        
        const timeoutId = setTimeout(() => {
            getDislocationsByAnalysisId(selectedAnalysisRight);
        }, 200);
        
        return () => clearTimeout(timeoutId);
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

    const modelRailLeftProps: ModelRailProps = useMemo(() => ({ 
        modelsForCurrentFrame: availableModelsLeft.map((model: string) => ({
            frame: currentTimestep,
            model,
            analysisId: selectedAnalysisLeft || undefined
        })), 
        selectedModel: selectedModelLeft, 
        onModelChange: setSelectedModelLeft 
    }), [availableModelsLeft, currentTimestep, selectedAnalysisLeft, selectedModelLeft]);

    const modelRailRightProps: ModelRailProps = useMemo(() => ({ 
        modelsForCurrentFrame: availableModelsRight.map((model: string) => ({
            frame: currentTimestep,
            model,
            analysisId: selectedAnalysisRight || undefined
        })), 
        selectedModel: selectedModelRight, 
        onModelChange: setSelectedModelRight 
    }), [availableModelsRight, currentTimestep, selectedAnalysisRight, selectedModelRight]);

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
                        Precargando frames: {preloadProgress}%
                    </div>
                )}
                
                <div className='raster-scenes-top-container' style={{ alignItems: 'stretch', gap: '0.75rem' }}>
                    <SceneColumn
                        scene={currentSceneLeft}
                        dislocationData={dislocationDataLeft}
                        isDislocationsLoading={isDislocationsLoadingLeft}
                        showDislocations={showDislocations}
                        isPlaying={isPlaying}
                        isLoading={isLoading}
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
                        isLoading={isLoading}
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
                    isLoading={isLoading}
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