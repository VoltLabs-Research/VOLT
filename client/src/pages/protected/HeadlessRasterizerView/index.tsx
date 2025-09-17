import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import useUrlState from '@/hooks/core/use-url-state';
import useRasterStore from '@/stores/raster';
import useTrajectoryStore from '@/stores/trajectories';
import useAnalysisConfigStore from '@/stores/analysis-config';
import type { AnalysisSelectProps, FrameObject, MetricEntry, ModelRailProps, PlaybackControlsProps, Scene } from '@/types/raster';
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

    const { trajectory, analyses, analysesNames, getRasterFrames, isLoading } = useRasterStore();
    const { getMetrics, trajectoryMetrics, isMetricsLoading } = useTrajectoryStore();
    const { getDislocationsByAnalysisId, analysisDislocationsById } = useAnalysisConfigStore();

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
    const getRasterFramesRef = useRef(getRasterFrames);
    const getMetricsRef = useRef(getMetrics);

    useEffect(() => {
        getRasterFramesRef.current = getRasterFrames;
        getMetricsRef.current = getMetrics;
    }, [getRasterFrames, getMetrics]);

    useEffect(() => {
        if(!trajectoryId) return;
        if(fetchedForIdRef.current === trajectoryId) return;
        fetchedForIdRef.current = trajectoryId;

        getRasterFramesRef.current(trajectoryId);
        getMetricsRef.current(trajectoryId);
    }, [trajectoryId]);

    const isValidNumber = (x: any): x is number => typeof x === "number" && Number.isFinite(x);

    const findFrameByTimestep = (frames: FrameObject[], timestep: number): FrameObject | null => {
        return frames.find((frame) => extractTimestepFromFrame(frame) === timestep) || null;
    };

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

    const getSceneFromFrame = (frameObj: FrameObject | null, preferredModel: string): Scene | null => {
        if(!frameObj) return null;
        if(frameObj[preferredModel]){
            return frameObj[preferredModel];
        }
        const availableScenes = Object.values(frameObj);
        return availableScenes[0] || null;
    };

    const extractTimestepFromFrame = (frameObj: FrameObject | null): number | null => {
        if(!frameObj) return null;
        for(const scene of Object.values(frameObj)){
            if(scene && isValidNumber(scene.frame)){
                return scene.frame;
            }
        }

        return null;
    };

    const resolveModelName = (desired: string | null, availableModels: string[]): string => {
        if(!desired) return 'preview';
        if(availableModels.includes(desired)) return desired;
        return availableModels[0];
    };

    const getTimestepsFromFrames = (frames: FrameObject[]): number[] => {
        const timesteps = frames.map(extractTimestepFromFrame).filter(isValidNumber);
        return Array.from(new Set(timesteps)).sort((a, b) => a - b);
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

    const sortedFramesLeft = useMemo(() => {
        if(!selectedAnalysisLeft || !analyses?.[selectedAnalysisLeft]?.frames) return [];

        return Object.values(analyses[selectedAnalysisLeft].frames)
            .sort((a: any, b: any) => {
                const timestepA = extractTimestepFromFrame(a) ?? 0;
                const timestepB = extractTimestepFromFrame(b) ?? 0;
                return timestepA - timestepB;
            });
    }, [selectedAnalysisLeft, analyses]);

    const sortedFramesRight = useMemo(() => {
        if(!selectedAnalysisRight || !analyses?.[selectedAnalysisRight]?.frames) return [];

        return Object.values(analyses[selectedAnalysisRight].frames)
            .sort((a: any, b: any) => {
                const timestepA = extractTimestepFromFrame(a) ?? 0;
                const timestepB = extractTimestepFromFrame(b) ?? 0;
                return timestepA - timestepB;
            });
    }, [selectedAnalysisRight, analyses]);

    const timeline = useMemo(() => {
        const timestepsLeft = getTimestepsFromFrames(sortedFramesLeft as FrameObject[]);
        const timestepsRight = getTimestepsFromFrames(sortedFramesRight as FrameObject[]);

        if(timestepsLeft.length > 0 && timestepsRight.length > 0){
            const intersectionSet = new Set(timestepsLeft);
            const intersection = timestepsRight.filter((ts) => intersectionSet.has(ts));

            if(intersection.length > 0) return intersection.sort((a, b) => a - b);
            const unionSet = new Set([ ...timestepsLeft, ...timestepsRight ]);
            return Array.from(unionSet).sort((a, b) => a - b);
        }

        return timestepsLeft.length > 0 ? timestepsLeft : timestepsRight;
    }, [sortedFramesLeft, sortedFramesRight]);

    const currentTimestep = timeline[selectedFrameIndex];

    const currentFrameLeft = useMemo(() => {
        return findFrameByTimestep(sortedFramesLeft as FrameObject[], currentTimestep);
    }, [sortedFramesLeft, currentTimestep]);

    const currentFrameRight = useMemo(() => {
        return findFrameByTimestep(sortedFramesRight as FrameObject[], currentTimestep);
    }, [sortedFramesRight, currentTimestep]);

    const currentSceneLeft = useMemo(() => {
        return getSceneFromFrame(currentFrameLeft, selectedModelLeft);
    }, [currentFrameLeft, selectedModelLeft]);

    const currentSceneRight = useMemo(() => {
        return getSceneFromFrame(currentFrameRight, selectedModelRight);
    }, [currentFrameRight, selectedModelRight]);

    const dislocationsLeft = selectedAnalysisLeft ? analysisDislocationsById?.[selectedAnalysisLeft] : undefined;
    const dislocationsRight = selectedAnalysisRight ? analysisDislocationsById?.[selectedAnalysisRight] : undefined;
    const dislocationDataLeft = findDislocationByTimestep(dislocationsLeft, currentTimestep);
    const dislocationDataRight = findDislocationByTimestep(dislocationsRight, currentTimestep);

    const isDislocationsLoadingLeft = showDislocations && !!selectedAnalysisLeft && dislocationsLeft === undefined;
    const isDislocationsLoadingRight = showDislocations && !!selectedAnalysisRight && dislocationsRight === undefined;

    const metricEntries: MetricEntry[] = useMemo(() => {
        const framesCount = trajectoryMetrics?.frames?.totalFrames;
        const totalSize = trajectoryMetrics?.files?.totalSizeBytes;
        const analysesCount = trajectoryMetrics?.structureAnalysis?.totalDocs;

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
        if(!currentFrameLeft || !isInitializedRef.current || modelsFromUrlRef.current.left) return;
        const availableModels = Object.keys(currentFrameLeft);
        const resolvedModel = resolveModelName(selectedModelLeft, availableModels);
        
        if(resolvedModel !== selectedModelLeft){
            setSelectedModelLeft(resolvedModel);
        }
    }, [currentFrameLeft, selectedModelLeft]);

    useEffect(() => {
        if(!currentFrameRight || !isInitializedRef.current || modelsFromUrlRef.current.right) return;
        const availableModels = Object.keys(currentFrameRight);
        const resolvedModel = resolveModelName(selectedModelRight, availableModels);

        if(resolvedModel !== selectedModelRight){
            setSelectedModelRight(resolvedModel);
        }
    }, [currentFrameRight, selectedModelRight]);

    // Update URL when state changes (but not during initial restoration)
    useEffect(() => {
        if(!isInitializedRef.current) return;
        const updates: Record<string, string | null> = {
            al: selectedAnalysisLeft,
            ar: selectedAnalysisRight,
            ml: selectedModelLeft,
            mr: selectedModelRight,
            disl: showDislocations ? "1" : null,
            ts: isValidNumber(currentTimestep) ? String(currentTimestep) : null
        };
        updateUrlParams(updates);
    }, [
        selectedAnalysisLeft,
        selectedAnalysisRight, 
        selectedModelLeft,
        selectedModelRight,
        showDislocations,
        currentTimestep,
        updateUrlParams
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

    // Load dislocation data when needed
    useEffect(() => {
        if(selectedAnalysisLeft && showDislocations){
            getDislocationsByAnalysisId(selectedAnalysisLeft);
        }
    }, [selectedAnalysisLeft, showDislocations, getDislocationsByAnalysisId]);

    useEffect(() => {
        if(selectedAnalysisRight && showDislocations){
            getDislocationsByAnalysisId(selectedAnalysisRight);
        }
    }, [selectedAnalysisRight, showDislocations, getDislocationsByAnalysisId]);

    // Event handlers
    const handlePlayPause = useCallback(() => {
        setIsPlaying((prev) => !prev);
    }, []);

    const handlePrev = useCallback(() => {
        if(timeline.length === 0) return;
        setSelectedFrameIndex((prev) => (prev === 0 ? timeline.length - 1 : prev - 1));
    }, [timeline.length]);

    const handleNext = useCallback(() => {
        if(timeline.length === 0) return;
        setSelectedFrameIndex((prev) => (prev + 1) % timeline.length);
    }, [timeline.length]);

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
        const leftFrame = findFrameByTimestep(sortedFramesLeft as FrameObject[], timestep);
        const leftScene = getSceneFromFrame(leftFrame, selectedModelLeft);
        if(leftScene?.data) return leftScene;

        const rightFrame = findFrameByTimestep(sortedFramesRight as FrameObject[], timestep);
        const rightScene = getSceneFromFrame(rightFrame, selectedModelRight);
        return rightScene?.data ? rightScene : null;
    }, [sortedFramesLeft, sortedFramesRight, selectedModelLeft, selectedModelRight]);

    const playbackControlsProps: PlaybackControlsProps = { 
        isPlaying, 
        onPlayPause: handlePlayPause 
    };

    const analysisSelectLeftProps: AnalysisSelectProps = { 
        analysesNames: analysesNames || [], 
        selectedAnalysis: selectedAnalysisLeft, 
        onAnalysisChange: setSelectedAnalysisLeft, 
        isLoading 
    };

    const analysisSelectRightProps: AnalysisSelectProps = { 
        analysesNames: analysesNames || [],
        selectedAnalysis: selectedAnalysisRight, 
        onAnalysisChange: setSelectedAnalysisRight, 
        isLoading 
    };

    const modelRailLeftProps: ModelRailProps = { 
        modelsForCurrentFrame: currentFrameLeft ? Object.values(currentFrameLeft) : [], 
        selectedModel: selectedModelLeft, 
        onModelChange: setSelectedModelLeft 
    };

    const modelRailRightProps: ModelRailProps = { 
        modelsForCurrentFrame: currentFrameRight ? Object.values(currentFrameRight) : [], 
        selectedModel: selectedModelRight, 
        onModelChange: setSelectedModelRight 
    };

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
                        delay={0.05}
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