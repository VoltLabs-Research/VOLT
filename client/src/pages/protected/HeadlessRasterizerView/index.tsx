/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import useUrlState from '@/hooks/core/use-url-state';
import useRasterStore from '@/stores/raster';
import useTrajectoryStore from '@/stores/trajectories';
import useAnalysisConfigStore from '@/stores/analysis-config';
import { useStructureAnalysisStore } from '@/stores/structure-analysis';
import usePluginStore from '@/stores/plugins';
import type { RenderableExposure } from '@/stores/plugins';
import useAuthStore from '@/stores/authentication';
import useRasterFrame from '@/hooks/raster/use-raster-frame';
import type { AnalysisSelectProps, MetricEntry, ModelRailProps, PlaybackControlsProps, RasterTool, Scene } from '@/types/raster';
import { formatNumber, formatSize } from '@/utilities/scene-utils';
import { getOrCreateGuestUser } from '@/utilities/guest';
import { IoTimeOutline, IoLayersOutline, IoBarChartOutline } from 'react-icons/io5';
import { socketService } from '@/services/socketio';
import RasterHeader from '@/components/molecules/raster/RasterHeader';
import SceneColumn from '@/components/molecules/raster/SceneColumn';
import Thumbnails from '@/components/molecules/raster/Thumbnails';
import MetricsBar from '@/components/molecules/raster/MetricsBar';
import CursorShareLayer from '@/components/atoms/CursorShareLayer';
import EmptyState from '@/components/atoms/EmptyState';
import useRasterConnectedUsers from '@/hooks/raster/useRasterConnectedUsers';
import FrameAtomsTable from '@/components/organisms/FrameAtomsTable';
import TrajectoryFileExplorer from '@/components/organisms/TrajectoryFileExplorer';
import './HeadlessRasterizerView.css';
import './RasterMessages.css';

const HeadlessRasterizerView: React.FC = () => {
    const navigate = useNavigate();
    const { trajectoryId } = useParams<{ trajectoryId: string }>();
    const { updateUrlParams, getUrlParam } = useUrlState();

    const {
        trajectory,
        analyses,
        analysesNames,
        getRasterFrames,
        isLoading,
        preloadAllFrames,
        preloadPriorizedFrames,
        isPreloading,
        preloadProgress,
        error,
    } = useRasterStore();

    const { getMetrics, trajectoryMetrics, isMetricsLoading } = useTrajectoryStore();
    const { getDislocationsByAnalysisId, analysisDislocationsById } = useAnalysisConfigStore();
    const { fetchStructureAnalysesByConfig } = useStructureAnalysisStore();
    const { getRenderableExposures, fetchManifests } = usePluginStore();
    const user = useAuthStore((state) => state.user);
    const connectedUsers = useRasterConnectedUsers(trajectoryId);

    const cursorUser: any = useMemo(() => {
        if (!user) return undefined;
        const u: any = { id: String(user._id ?? 'anon'), color: '#8A63D2' };
        if (user.firstName) u.firstName = user.firstName;
        if (user.lastName) u.lastName = user.lastName;
        if (user.email) u.email = user.email;
        return getOrCreateGuestUser();
    }, [user?._id, user?.firstName, user?.lastName, user?.email]);

    const [leftAnalysis, setLeftAnalysis] = useState<string | null>(null);
    const [rightAnalysis, setRightAnalysis] = useState<string | null>(null);
    const [leftModel, setLeftModel] = useState<string>('__preview__');
    const [rightModel, setRightModel] = useState<string>('__preview__');
    const [frameIndex, setFrameIndex] = useState<number>(-1);

    const [isPlaying, setIsPlaying] = useState(false);

    // Dynamic exposures state: exposureId -> boolean
    const [activeExposures, setActiveExposures] = useState<Record<string, boolean>>({});
    const [availableExposures, setAvailableExposures] = useState<RenderableExposure[]>([]);

    // Dynamic tools state: toolId -> boolean
    const [activeTools, setActiveTools] = useState<Record<string, boolean>>({});

    const initializedRef = useRef(false);
    const preloadKeyRef = useRef<string | null>(null);

    useEffect(() => {
        fetchManifests();
    }, [fetchManifests]);

    useEffect(() => {
        if (!trajectoryId) return;
        getRasterFrames(trajectoryId);
        getMetrics(trajectoryId);

        return () => {
            preloadKeyRef.current = null;
        };
    }, [trajectoryId, getRasterFrames, getMetrics]);

    // Update available exposures when analysis changes
    useEffect(() => {
        const updateExposures = async () => {
            if (!trajectoryId || !leftAnalysis) return;
            const exposures = await getRenderableExposures(trajectoryId, leftAnalysis, 'raster');
            setAvailableExposures(exposures);
        };
        updateExposures();
    }, [trajectoryId, leftAnalysis, getRenderableExposures]);

    const framesFor = (analysisId: string | null) => {
        if (!analysisId || !analyses?.[analysisId]?.frames) return [];

        return Object.keys(analyses[analysisId].frames)
            .map((timestepStr) => parseInt(timestepStr, 10))
            .filter((timestep) => Number.isFinite(timestep))
            .sort((a, b) => a - b);
    };

    const timeline = useMemo<number[]>(() => {
        const L = framesFor(leftAnalysis);
        const R = framesFor(rightAnalysis);

        if (!L.length && !R.length) return [];
        if (!L.length) return R;
        if (!R.length) return L;

        const setL = new Set(L);
        const intersection = R.filter((timestep) => setL.has(timestep));
        if (intersection.length) {
            return intersection;
        }

        const union = new Set([...L, ...R]);
        return Array.from(union).sort((a, b) => a - b);
    }, [analyses, leftAnalysis, rightAnalysis]);

    const currentTimestep = frameIndex >= 0 && frameIndex < timeline.length ? timeline[frameIndex] : undefined;

    const closestIndex = (timestep: number, list: number[]) => {
        if (!list.length) return 0;

        let best = 0;
        let bestD = Math.abs(list[0] - timestep);

        for (let i = 1; i < list.length; i++) {
            const d = Math.abs(list[i] - timestep);
            if (d < bestD) {
                best = i;
                bestD = d;
            }
        }

        return best;
    };

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                setIsPlaying((isPlaying) => !isPlaying);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, []);

    useEffect(() => {
        if (!trajectory?._id || initializedRef.current) return;

        const al = getUrlParam('al');
        const ar = getUrlParam('ar');
        const ml = getUrlParam('ml');
        const mr = getUrlParam('mr');
        const ts = parseInt(getUrlParam('ts') || '0', 10);

        // Restore active exposures from URL
        const exposuresParam = getUrlParam('exposures');
        if (exposuresParam) {
            try {
                const parsed = JSON.parse(atob(exposuresParam));
                setActiveExposures(parsed);
            } catch (e) {
                console.error("Failed to parse exposures param", e);
            }
        } else {
            // Legacy fallback
            const disl = getUrlParam('disl') === '1';
            const sa = getUrlParam('sa') === '1';
            if (disl || sa) {
                setActiveExposures({
                    'dislocation-analysis': disl,
                    'structure-identification-stats': sa
                });
            }
        }

        const validIds = new Set(analysesNames.map((a) => a._id));
        const left = al && validIds.has(al) ? al : analysesNames[0]?._id ?? null;
        const right = ar && validIds.has(ar) ? ar : analysesNames[1]?._id ?? left;

        setLeftAnalysis(left);
        setRightAnalysis(right);

        setTimeout(() => {
            const tsList = (() => {
                const L = framesFor(left);
                const R = framesFor(right);

                if (!L.length && !R.length) return [];
                if (!L.length) return R;
                if (!R.length) return L;

                const setL = new Set(L);
                const intersection = R.filter((timestep) => setL.has(timestep));
                if (intersection.length) {
                    return intersection;
                }

                const union = new Set([...L, ...R]);
                return Array.from(union).sort((a, b) => a - b);
            })();

            const initialIndex = Number.isFinite(ts) && tsList.length ?
                closestIndex(ts, tsList) : 0;

            setFrameIndex(initialIndex);

            const modelsFor = (analysisId: string | null, timestep?: number) => {
                if (!analysisId || !timestep || !analyses?.[analysisId]?.frames?.[timestep]) return [];
                return (analyses[analysisId].frames[timestep].availableModels) ?? [];
            };

            const leftModels = modelsFor(left, tsList[initialIndex]);
            const rightModels = modelsFor(right, tsList[initialIndex]);

            setLeftModel(ml && leftModels.includes(ml) ? ml : leftModels[0] ?? 'preview');
            setRightModel(mr && rightModels.includes(mr) ? mr : rightModels[0] ?? 'preview');

            initializedRef.current = true;
        }, 0);
    }, [trajectory]);

    const modelsLeft = useMemo(() => {
        if (!leftAnalysis || currentTimestep === undefined) return [];
        const frame = analyses?.[leftAnalysis]?.frames?.[currentTimestep];
        return (frame?.availableModels) ?? [];
    }, [analyses, leftAnalysis, currentTimestep]);

    const modelsRight = useMemo(() => {
        if (!rightAnalysis || currentTimestep === undefined) return [];
        const frame = analyses?.[rightAnalysis]?.frames?.[currentTimestep];
        return (frame?.availableModels) ?? [];
    }, [analyses, rightAnalysis, currentTimestep]);

    useEffect(() => {
        if (!initializedRef.current) return;
        if (modelsLeft.length && !modelsLeft.includes(leftModel)) {
            setLeftModel(modelsLeft[0]);
        }
    }, [modelsLeft, leftModel]);

    useEffect(() => {
        if (!initializedRef.current) return;
        if (modelsRight.length && !modelsRight.includes(rightModel)) {
            setRightModel(modelsRight[0]);
        }
    }, [modelsRight, rightModel]);

    useEffect(() => {
        if (!initializedRef.current || !trajectoryId || !analyses || isLoading) return;
        if (!timeline.length || currentTimestep === undefined) return;

        const key = JSON.stringify({
            id: trajectoryId,
            ml: leftModel,
            mr: rightModel,
            ts: currentTimestep
        });

        if (preloadKeyRef.current === key) return;
        preloadKeyRef.current = key;

        const priority: { ml?: string; mr?: string } = {};
        if (leftModel && leftModel !== 'preview') priority.ml = leftModel;
        if (rightModel && rightModel !== 'preview') priority.mr = rightModel;

        if (priority.ml || priority.mr) {
            preloadPriorizedFrames(trajectoryId, priority, currentTimestep);
        } else {
            preloadAllFrames(trajectoryId);
        }
    }, [
        initializedRef.current,
        trajectoryId,
        analyses,
        isLoading,
        timeline.length,
        currentTimestep,
        leftModel,
        rightModel,
        preloadPriorizedFrames,
        preloadAllFrames
    ]);

    useEffect(() => {
        if (!initializedRef.current) return;

        const handle = setTimeout(() => {
            const updates: Record<string, string | null> = {
                al: leftAnalysis,
                ar: rightAnalysis,
                ml: leftModel || null,
                mr: rightModel || null,
                ts: Number.isFinite(currentTimestep) ? String(currentTimestep) : null,
                exposures: Object.keys(activeExposures).length > 0
                    ? btoa(JSON.stringify(activeExposures))
                    : null
            };
            updateUrlParams(updates);
        }, isPlaying ? 500 : 120);

        return () => clearTimeout(handle);
    }, [
        initializedRef.current,
        leftAnalysis,
        rightAnalysis,
        leftModel,
        rightModel,
        activeExposures,
        currentTimestep,
        isPlaying,
        updateUrlParams,
    ]);

    useEffect(() => {
        if (!isPlaying || !timeline.length) return;
        const id = setInterval(() => {
            if (!timeline.length) return;

            if (frameIndex >= timeline.length) {
                setFrameIndex(timeline.length - 1);
            } else if (frameIndex < 0) {
                setFrameIndex(0);
            } else {
                setFrameIndex((i) => (timeline.length ? (i + 1) % timeline.length : i));
            }
        }, 500);

        return () => clearInterval(id);
    }, [isPlaying, timeline.length]);

    // Data fetching for active exposures based on results type
    useEffect(() => {
        availableExposures.forEach(exposure => {
            if (!activeExposures[exposure.exposureId]) return;

            // Identify exposure type by results filename
            if (exposure.results === 'dislocations.msgpack') {
                if (leftAnalysis) getDislocationsByAnalysisId(leftAnalysis);
                if (rightAnalysis && rightAnalysis !== leftAnalysis) getDislocationsByAnalysisId(rightAnalysis);
            } else if (exposure.results === 'structure_stats.msgpack') {
                if (leftAnalysis) fetchStructureAnalysesByConfig(leftAnalysis);
                if (rightAnalysis && rightAnalysis !== leftAnalysis) fetchStructureAnalysesByConfig(rightAnalysis);
            }
        });
    }, [activeExposures, availableExposures, leftAnalysis, rightAnalysis, getDislocationsByAnalysisId, fetchStructureAnalysesByConfig]);

    const subscribedKeyRef = useRef<string | null>(null);

    useEffect(() => {
        if (!trajectory?._id || !trajectoryId) return;

        const presenceUser = user && user._id
            ? {
                id: String(user._id),
                ...(user.firstName ? { firstName: user.firstName } : {}),
                ...(user.lastName ? { lastName: user.lastName } : {}),
                ...(user.email ? { email: user.email } : {})
            }
            : getOrCreateGuestUser();

        const key = `${trajectory._id}:${presenceUser.id}`;
        if (subscribedKeyRef.current === key) return;

        const prevTrajectory = subscribedKeyRef.current?.split(':')[0];
        socketService.subscribeToTrajectory(trajectory._id, presenceUser, prevTrajectory);
        subscribedKeyRef.current = key;
    }, [trajectory?._id, trajectoryId, user?._id, user?.firstName, user?.lastName, user?.email]);

    const leftScene = useRasterFrame(
        trajectoryId,
        currentTimestep,
        leftAnalysis || undefined,
        leftModel || 'preview'
    );

    const rightScene = useRasterFrame(
        trajectoryId,
        currentTimestep,
        rightAnalysis || undefined,
        rightModel || 'preview'
    );

    const dislLeft = leftAnalysis ? analysisDislocationsById?.[leftAnalysis] : undefined;
    const dislRight = rightAnalysis ? analysisDislocationsById?.[rightAnalysis] : undefined;

    const findDisl = (arr: any[] | undefined, timestep?: number) => {
        return arr?.find?.((d) => Number.isFinite(d?.timestep) && d.timestep === timestep);
    };

    const dislDataLeft = findDisl(dislLeft, currentTimestep);
    const dislDataRight = findDisl(dislRight, currentTimestep);

    const metricEntries: MetricEntry[] = useMemo(() => {
        const m = trajectoryMetrics as any;
        return [
            { key: 'frames.totalFrames', label: 'Frames', value: formatNumber(m?.frames?.totalFrames), icon: IoTimeOutline },
            { key: 'files.totalSizeBytes', label: 'Size', value: formatSize(m?.files?.totalSizeBytes), icon: IoLayersOutline },
            { key: 'structureAnalysis.totalDocs', label: 'Analyses', value: formatNumber(m?.structureAnalysis?.totalDocs), icon: IoBarChartOutline },
        ];
    }, [trajectoryMetrics]);

    const handlePlayPause = useCallback(() => setIsPlaying((p) => !p), []);
    const handleGoBack = useCallback(() => navigate('/dashboard'), [navigate]);
    const handleView3D = useCallback(() => trajectory?._id && navigate(`/canvas/${trajectory._id}/`), [trajectory, navigate]);
    const handleSignIn = useCallback(() => navigate('/auth/sign-in'), [navigate]);
    const handleThumbClick = useCallback((i: number) => setFrameIndex(i), []);

    const toggleExposure = useCallback((exposureId: string) => {
        setActiveExposures((prev) => ({
            ...prev,
            [exposureId]: !prev[exposureId]
        }));
    }, []);

    const toggleTool = useCallback((toolId: string) => {
        setActiveTools((prev) => ({
            ...prev,
            [toolId]: !prev[toolId]
        }));
    }, []);

    const playbackControlsProps: PlaybackControlsProps = useMemo(() => {
        return {
            isPlaying,
            onPlayPause: handlePlayPause
        };
    }, [isPlaying, handlePlayPause]);

    const analysisSelectLeftProps: AnalysisSelectProps = useMemo(() => {
        return {
            analysesNames: analysesNames || [],
            selectedAnalysis: leftAnalysis,
            onAnalysisChange: setLeftAnalysis,
            isLoading
        };
    }, [analysesNames, leftAnalysis, isLoading]);

    const analysisSelectRightProps: AnalysisSelectProps = useMemo(() => {
        return {
            analysesNames: analysesNames || [],
            selectedAnalysis: rightAnalysis,
            onAnalysisChange: setRightAnalysis,
            isLoading
        };
    }, [analysesNames, rightAnalysis, isLoading]);

    const modelRailLeftProps: ModelRailProps = useMemo(() => {
        return {
            modelsForCurrentFrame: (modelsLeft || []).map((m: any) => ({
                frame: currentTimestep ?? 0,
                model: m,
                analysisId: leftAnalysis
            })),
            selectedModel: leftModel,
            onModelChange: setLeftModel
        };
    }, [modelsLeft, currentTimestep, leftAnalysis, leftModel]);

    const modelRailRightProps: ModelRailProps = useMemo(() => {
        return {
            modelsForCurrentFrame: (modelsRight || []).map((m: any) => ({
                frame: currentTimestep ?? 0,
                model: m,
                analysisId: rightAnalysis!,
            })),
            selectedModel: rightModel,
            onModelChange: setRightModel,
        }
    }, [modelsRight, currentTimestep, rightAnalysis, rightModel]);

    const getThumbnailScene = useCallback((timestep: number): Scene | null => {
        const analysisId = leftAnalysis || rightAnalysis;
        const model = leftAnalysis ? leftModel : rightModel;
        if (!analysisId) return null;
        const available = analyses?.[analysisId]?.frames?.[timestep]?.availableModels as string[] | undefined;
        const isReady = !!available?.includes(model);
        return {
            frame: timestep,
            model,
            analysisId,
            isLoading: !isReady || timestep !== currentTimestep
        };
    }, [analyses, leftAnalysis, rightAnalysis, leftModel, rightModel, currentTimestep]);

    const canRender = Boolean(
        trajectory?._id &&
        timeline.length &&
        frameIndex >= 0 &&
        (leftAnalysis || rightAnalysis) &&
        currentTimestep !== undefined
    );

    const hasNoRasterData = !isLoading && (!trajectory || ((!analysesNames || analysesNames.length === 0) && (!trajectory?.frames || trajectory.frames.length === 0)));
    const hasError = !!error;

    // Generate dynamic tools list
    const tools: RasterTool[] = useMemo(() => {
        const t: RasterTool[] = [];

        // Always available tools
        t.push({
            id: 'frame-particles',
            label: 'Frame Particles',
            isActive: !!activeTools['frame-particles']
        });

        t.push({
            id: 'file-explorer',
            label: 'File Explorer',
            isActive: !!activeTools['file-explorer']
        });

        return t;
    }, [availableExposures, activeTools]);

    return (
        <CursorShareLayer roomName={trajectoryId} user={cursorUser} className='raster-view-container' style={{ position: 'relative' }}>
            <RasterHeader
                trajectory={trajectory}
                isLoading={isLoading}
                onGoBack={handleGoBack}
                onView3D={handleView3D}
                onSignIn={!user ? handleSignIn : undefined}
                connectedUsers={connectedUsers}
            />

            {activeTools['file-explorer'] && <TrajectoryFileExplorer onClose={() => toggleTool('file-explorer')} />}

            {activeTools['frame-particles'] && (
                <FrameAtomsTable
                    trajectoryId={trajectory?._id}
                    timestep={currentTimestep as number}
                    pageSize={100}
                    initialPage={1}
                    decimals={3}
                    onClose={() => toggleTool('frame-particles')}
                />
            )}

            <div className='raster-scenes-container' style={{ position: 'relative' }}>
                {isPreloading && (
                    <div
                        className='preloading-container'
                    >
                        <div
                            className='preloading-anim'
                        />

                        Preloading frames: {preloadProgress}%
                    </div>
                )}

                {hasNoRasterData && !isLoading && (
                    <div className="raster-empty-state-overlay">
                        <EmptyState
                            title="No Rasterized Data"
                            description="This trajectory hasn't been rasterized yet. Rasterize it first to view the visualization and analysis results."
                            buttonText="Return to Dashboard"
                            buttonOnClick={handleGoBack}
                            className="raster-empty-state-content"
                        />
                    </div>
                )}

                <div className='raster-scenes-top-container' style={{ alignItems: 'stretch', gap: '0.75rem' }}>
                    <SceneColumn
                        trajectoryId={trajectory?._id}
                        scene={canRender ? leftScene.scene ?? null : null}
                        dislocationData={dislDataLeft}
                        isDislocationsLoading={!!leftAnalysis && !dislDataLeft && availableExposures.some(e => activeExposures[e.exposureId] && e.results === 'dislocations.msgpack')}
                        activeExposures={activeExposures}
                        availableExposures={availableExposures}
                        isPlaying={isPlaying}
                        isLoading={isLoading || !canRender || leftScene.isLoading}
                        playbackControls={playbackControlsProps}
                        analysisSelect={analysisSelectLeftProps}
                        modelRail={modelRailLeftProps}
                        configId={leftAnalysis || undefined}
                        timestep={currentTimestep}
                        delay={0}
                    />

                    <SceneColumn
                        trajectoryId={trajectory?._id}
                        scene={canRender ? rightScene.scene ?? null : null}
                        dislocationData={dislDataRight}
                        isDislocationsLoading={!!rightAnalysis && !dislDataRight && availableExposures.some(e => activeExposures[e.exposureId] && e.results === 'dislocations.msgpack')}
                        activeExposures={activeExposures}
                        availableExposures={availableExposures}
                        isPlaying={isPlaying}
                        isLoading={isLoading || !canRender || rightScene.isLoading}
                        playbackControls={playbackControlsProps}
                        analysisSelect={analysisSelectRightProps}
                        modelRail={modelRailRightProps}
                        configId={rightAnalysis || undefined}
                        timestep={currentTimestep}
                        delay={0.1}
                    />
                </div>

                <Thumbnails
                    timeline={timeline}
                    selectedFrameIndex={frameIndex}
                    isPlaying={isPlaying}
                    isLoading={isLoading || !timeline.length}
                    onThumbnailClick={handleThumbClick}
                    getThumbnailScene={getThumbnailScene}
                />

                <MetricsBar
                    items={metricEntries}
                    isLoading={isMetricsLoading}
                    availableExposures={availableExposures}
                    activeExposures={activeExposures}
                    onToggleExposure={toggleExposure}
                    tools={tools}
                    onToggleTool={toggleTool}
                />
            </div>
        </CursorShareLayer>
    );
};

export default HeadlessRasterizerView;