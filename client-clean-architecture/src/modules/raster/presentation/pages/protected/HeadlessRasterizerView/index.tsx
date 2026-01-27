/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePageTitle } from '@/shared/presentation/hooks/core/use-page-title';
import { useNavigate, useParams } from 'react-router';
import useUrlState from '@/shared/presentation/hooks/core/use-url-state';
import useAppInitializer from '@/shared/presentation/hooks/core/use-app-initializer';
import { useRasterStore } from '@/modules/raster/presentation/stores';
import { useAuthStore } from '@/modules/auth/presentation/stores';
import { useTeamStore } from '@/modules/team/presentation/stores';
import useRasterFrame from '@/modules/raster/presentation/hooks/use-raster-frame';
import type { AnalysisSelectProps, ModelRailProps, PlaybackControlsProps, Scene } from '@/types/raster';
import { getOrCreateGuestUser } from '@/shared/utilities/api/guest';
import RasterHeader from '@/modules/raster/presentation/components/components/RasterHeader';
import SceneColumn from '@/modules/raster/presentation/components/components/SceneColumn';
import Thumbnails from '@/modules/raster/presentation/components/components/Thumbnails';
import CursorShareLayer from '@/shared/presentation/components/atoms/common/CursorShareLayer';
import EmptyState from '@/shared/presentation/components/atoms/common/EmptyState';
import useRasterConnectedUsers from '@/modules/raster/presentation/hooks/use-raster-connected-users';
import '@/modules/raster/presentation/pages/protected/HeadlessRasterizerView/HeadlessRasterizerView.css';
import '@/modules/raster/presentation/pages/protected/HeadlessRasterizerView/RasterMessages.css';

const HeadlessRasterizerView: React.FC = () => {
    usePageTitle('Rasterizer');
    const navigate = useNavigate();
    const { trajectoryId } = useParams<{ trajectoryId: string }>();
    const { updateUrlParams, getUrlParam } = useUrlState();

    useAppInitializer();

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

    const user = useAuthStore((state) => state.user);
    const { selectedTeam, getUserTeams } = useTeamStore();
    const connectedUsers = useRasterConnectedUsers(trajectoryId);

    const [guestUser, setGuestUser] = useState<any>(null);

    useEffect(() => {
        if (user) return;
        getOrCreateGuestUser().then(setGuestUser);
    }, [user]);

    const cursorUser: any = useMemo(() => {
        if (user) {
            const u: any = { id: String(user._id ?? 'anon'), color: '#8A63D2' };
            if (user.firstName) u.firstName = user.firstName;
            if (user.lastName) u.lastName = user.lastName;
            if (user.email) u.email = user.email;
            return u;
        }
        return guestUser;
    }, [user, guestUser]);

    const [leftAnalysis, setLeftAnalysis] = useState<string | null>(null);
    const [rightAnalysis, setRightAnalysis] = useState<string | null>(null);
    const [leftModel, setLeftModel] = useState<string>('');
    const [rightModel, setRightModel] = useState<string>('');
    const [frameIndex, setFrameIndex] = useState<number>(-1);

    const [isPlaying, setIsPlaying] = useState(false);

    const initializedRef = useRef(false);
    const preloadKeyRef = useRef<string | null>(null);

    // Ensure teams are loaded (for RBAC teamId)
    useEffect(() => {
        if (!selectedTeam) {
            getUserTeams();
        }
    }, [selectedTeam, getUserTeams]);

    useEffect(() => {
        if (!trajectoryId || !selectedTeam) return;
        getRasterFrames(trajectoryId);

        return () => {
            preloadKeyRef.current = null;
        };
    }, [trajectoryId, selectedTeam, getRasterFrames]);

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

            setLeftModel(ml && leftModels.includes(ml) ? ml : leftModels[0] ?? '');
            setRightModel(mr && rightModels.includes(mr) ? mr : rightModels[0] ?? '');

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


    const subscribedKeyRef = useRef<string | null>(null);

    // Removed unused subscribeToTrajectory effect
    // Presence is handled by useRasterConnectedUsers via subscribe_to_raster

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


    const handlePlayPause = useCallback(() => setIsPlaying((p) => !p), []);
    const handleGoBack = useCallback(() => navigate('/dashboard'), [navigate]);
    const handleView3D = useCallback(() => trajectory?._id && navigate(`/canvas/${trajectory._id}/`), [trajectory, navigate]);
    const handleSignIn = useCallback(() => navigate('/auth/sign-in'), [navigate]);
    const handleThumbClick = useCallback((i: number) => setFrameIndex(i), []);


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


    return (
        <CursorShareLayer roomName={trajectoryId} user={cursorUser} className='raster-view-container h-max overflow-hidden' style={{ position: 'relative' }}>
            <RasterHeader
                trajectory={trajectory}
                isLoading={isLoading}
                onGoBack={handleGoBack}
                onView3D={handleView3D}
                onSignIn={!user ? handleSignIn : undefined}
                connectedUsers={connectedUsers}
            />

            {/* {activeTools['file-explorer'] && {<TrajectoryFileExplorer onClose={() => toggleTool('file-explorer')} />*/}


            <div className='d-flex column gap-1 raster-scenes-container p-relative w-max h-max' style={{ position: 'relative' }}>
                {isPreloading && (
                    <div
                        className='d-flex items-center gap-05 preloading-container p-absolute color-primary'
                    >
                        <div
                            className='preloading-anim'
                        />

                        Preloading frames: {preloadProgress}%
                    </div>
                )}

                {hasNoRasterData && !isLoading && (
                    <div className="d-flex flex-center raster-empty-state-overlay p-absolute">
                        <EmptyState
                            title="No Rasterized Data"
                            description="This trajectory hasn't been rasterized yet. Rasterize it first to view the visualization and analysis results."
                            buttonText="Return to Dashboard"
                            buttonOnClick={handleGoBack}
                            className="raster-empty-state-content"
                        />
                    </div>
                )}

                <div className='d-flex gap-1 raster-scenes-top-container w-max' style={{ alignItems: 'stretch', gap: '0.75rem' }}>
                    <SceneColumn
                        scene={canRender ? leftScene.scene ?? null : null}
                        isPlaying={isPlaying}
                        isLoading={isLoading || !canRender || leftScene.isLoading}
                        playbackControls={playbackControlsProps}
                        analysisSelect={analysisSelectLeftProps}
                        modelRail={modelRailLeftProps}
                        delay={0}
                    />

                    <SceneColumn
                        scene={canRender ? rightScene.scene ?? null : null}
                        isPlaying={isPlaying}
                        isLoading={isLoading || !canRender || rightScene.isLoading}
                        playbackControls={playbackControlsProps}
                        analysisSelect={analysisSelectRightProps}
                        modelRail={modelRailRightProps}
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
            </div>
        </CursorShareLayer>
    );
};

export default HeadlessRasterizerView;
