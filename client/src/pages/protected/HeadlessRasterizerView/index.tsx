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
import { IoTimeOutline, IoLayersOutline, IoBarChartOutline } from 'react-icons/io5';
import RasterHeader from '@/components/molecules/raster/RasterHeader';
import SceneColumn from '@/components/molecules/raster/SceneColumn';
import Thumbnails from '@/components/molecules/raster/Thumbnails';
import MetricsBar from '@/components/molecules/raster/MetricsBar';
import './HeadlessRasterizerView.css';

const DEFAULT_MODEL = 'preview';

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
    resetPreloadState,
  } = useRasterStore();

  const { getMetrics, trajectoryMetrics, isMetricsLoading } = useTrajectoryStore();
  const { getDislocationsByAnalysisId, analysisDislocationsById } = useAnalysisConfigStore();
  const { fetchStructureAnalysesByConfig } = useStructureAnalysisStore();
  const user = useAuthStore((state) => state.user);

  useCacheCleanup();

  // Selection state
  const [leftAnalysis, setLeftAnalysis] = useState<string | null>(null);
  const [rightAnalysis, setRightAnalysis] = useState<string | null>(null);
  const [leftModel, setLeftModel] = useState<string>(DEFAULT_MODEL);
  const [rightModel, setRightModel] = useState<string>(DEFAULT_MODEL);
  const [frameIndex, setFrameIndex] = useState<number>(-1);

  // UI toggles / playback
  const [isPlaying, setIsPlaying] = useState(false);
  const [showDislocations, setShowDislocations] = useState(false);
  const [showStructureAnalysis, setShowStructureAnalysis] = useState(false);

  // One-time and dedupe guards
  const initializedRef = useRef(false);
  const preloadKeyRef = useRef<string | null>(null);

  // --- helpers
  const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const safeParseInt = (s: string | null): number | null => {
    if (!s) return null;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  };
  const formatNumber = (n?: number) => (isFiniteNumber(n!) ? new Intl.NumberFormat().format(n as number) : '-');

  // Fetch metadata/metrics on mount or id change
  useEffect(() => {
    if (!trajectoryId) return;
    getRasterFrames(trajectoryId);
    getMetrics(trajectoryId);
    return () => {
      resetPreloadState(trajectoryId);
      preloadKeyRef.current = null;
    };
  }, [trajectoryId, getRasterFrames, getMetrics, resetPreloadState]);

  // Compute timeline from selected analyses
  const timeline = useMemo<number[]>(() => {
    const framesFor = (aid: string | null) => {
      if (!aid || !analyses?.[aid]?.frames) return [];
      return Object.keys(analyses[aid].frames)
        .map((k) => parseInt(k, 10))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);
    };
    const L = framesFor(leftAnalysis);
    const R = framesFor(rightAnalysis);
    if (!L.length && !R.length) return [];
    if (!L.length) return R;
    if (!R.length) return L;
    // prefer intersection; fallback to union
    const setL = new Set(L);
    const inter = R.filter((ts) => setL.has(ts));
    if (inter.length) return inter;
    return Array.from(new Set([...L, ...R])).sort((a, b) => a - b);
  }, [analyses, leftAnalysis, rightAnalysis]);

  const currentTimestep = frameIndex >= 0 && frameIndex < timeline.length ? timeline[frameIndex] : undefined;

  // Pick closest index helper
  const closestIndex = (ts: number, list: number[]) => {
    console.log('closest index - list:', list)
    if (!list.length) return 0;
    let best = 0;
    let bestD = Math.abs(list[0] - ts);
    for (let i = 1; i < list.length; i++) {
      const d = Math.abs(list[i] - ts);
      if (d < bestD) {
        best = i;
        bestD = d;
      }
    }

    console.log('best:', best);
    return best;
  };

  // Initial selection + URL restore (run exactly once after analyses arrive)
  useEffect(() => {
    if(!trajectory?._id || initializedRef.current) return;
    console.log('X');

    const urlAl = getUrlParam('al');
    const urlAr = getUrlParam('ar');
    const urlMl = getUrlParam('ml');
    const urlMr = getUrlParam('mr');
    const urlTs = safeParseInt(getUrlParam('ts'));
    const urlDisl = getUrlParam('disl') === '1';
    const urlSa = getUrlParam('sa') === '1';

    console.log('URL TS:', urlTs);

    const validIds = new Set(analysesNames.map((a) => a._id));
    const left = urlAl && validIds.has(urlAl) ? urlAl : analysesNames[0]?._id ?? null;
    const right =
      urlAr && validIds.has(urlAr)
        ? urlAr
        : analysesNames[1]?._id ?? left;

    setLeftAnalysis(left);
    setRightAnalysis(right);

    setShowDislocations(urlDisl);
    setShowStructureAnalysis(urlSa);

    // Select initial frame (after we have a timeline)
    // Do in next tick so timeline can compute once analyses state settles
    setTimeout(() => {
      const tsList = (() => {
        const framesFor = (aid: string | null) => {
          if (!aid || !analyses?.[aid]?.frames) return [];
          return Object.keys(analyses[aid].frames)
            .map((k) => parseInt(k, 10))
            .filter((n) => Number.isFinite(n))
            .sort((a, b) => a - b);
        };
        const L = framesFor(left);
        const R = framesFor(right);
        if (!L.length && !R.length) return [];
        if (!L.length) return R;
        if (!R.length) return L;
        const setL = new Set(L);
        const inter = R.filter((t) => setL.has(t));
        if (inter.length) return inter;
        return Array.from(new Set([...L, ...R])).sort((a, b) => a - b);
      })();

      const initialIndex =
        isFiniteNumber(urlTs!) && tsList.length
          ? closestIndex(urlTs as number, tsList)
          : 0;

        console.log('initial index:', initialIndex);
      setFrameIndex(initialIndex);

      // Set initial models if available for selected timestep; fall back to DEFAULT_MODEL
      const modelsFor = (aid: string | null, ts?: number) => {
        if (!aid || !ts || !analyses?.[aid]?.frames?.[ts]) return [] as string[];
        return (analyses[aid].frames[ts].availableModels as string[]) ?? [];
      };
      const leftModels = modelsFor(left, tsList[initialIndex]);
      const rightModels = modelsFor(right, tsList[initialIndex]);

      setLeftModel(urlMl && leftModels.includes(urlMl) ? urlMl : leftModels[0] ?? DEFAULT_MODEL);
      setRightModel(urlMr && rightModels.includes(urlMr) ? urlMr : rightModels[0] ?? DEFAULT_MODEL);

      initializedRef.current = true;
    }, 0);
  }, [trajectory]);

  // Available models for current timestep
  const modelsLeft = useMemo(() => {
    if (!leftAnalysis || currentTimestep === undefined) return [];
    const f = analyses?.[leftAnalysis]?.frames?.[currentTimestep];
    return (f?.availableModels as string[]) ?? [];
  }, [analyses, leftAnalysis, currentTimestep]);

  const modelsRight = useMemo(() => {
    if (!rightAnalysis || currentTimestep === undefined) return [];
    const f = analyses?.[rightAnalysis]?.frames?.[currentTimestep];
    return (f?.availableModels as string[]) ?? [];
  }, [analyses, rightAnalysis, currentTimestep]);

  // Validate selected model against available models (auto-correct)
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

  // Preload strategy: dedupe by key; re-run when (trajectoryId, models, timestep) change
  useEffect(() => {
    if (!initializedRef.current || !trajectoryId || !analyses || isLoading) return;
    if (!timeline.length || currentTimestep === undefined) return;

    const key = JSON.stringify({
      id: trajectoryId,
      ml: leftModel,
      mr: rightModel,
      ts: currentTimestep,
    });

    if (preloadKeyRef.current === key) return;
    preloadKeyRef.current = key;

    const priority: { ml?: string; mr?: string } = {};
    if (leftModel && leftModel !== DEFAULT_MODEL) priority.ml = leftModel;
    if (rightModel && rightModel !== DEFAULT_MODEL) priority.mr = rightModel;

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
    preloadAllFrames,
  ]);

  // URL syncing (debounced; slower during autoplay)
  useEffect(() => {
    if (!initializedRef.current) return;
    const handle = setTimeout(() => {
      const updates: Record<string, string | null> = {
        al: leftAnalysis,
        ar: rightAnalysis,
        ml: leftModel || null,
        mr: rightModel || null,
        disl: showDislocations ? '1' : null,
        sa: showStructureAnalysis ? '1' : null,
        ts: isFiniteNumber(currentTimestep) ? String(currentTimestep) : null,
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
    showDislocations,
    showStructureAnalysis,
    currentTimestep,
    isPlaying,
    updateUrlParams,
  ]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying || !timeline.length) return;
    const id = setInterval(() => {
        if (!timeline.length) return;
        if (frameIndex >= timeline.length) setFrameIndex(timeline.length - 1);
        else if (frameIndex < 0) setFrameIndex(0);
        else{
      setFrameIndex((i) => (timeline.length ? (i + 1) % timeline.length : i));
        }
    }, 500);
    return () => clearInterval(id);
  }, [isPlaying, timeline.length]);

  // Side-data loading (dislocations / structure analysis)
  useEffect(() => {
    if (!showDislocations) return;
    if (leftAnalysis) getDislocationsByAnalysisId(leftAnalysis);
    if (rightAnalysis && rightAnalysis !== leftAnalysis) getDislocationsByAnalysisId(rightAnalysis);
  }, [showDislocations, leftAnalysis, rightAnalysis, getDislocationsByAnalysisId]);

  useEffect(() => {
    if (!showStructureAnalysis) return;
    if (leftAnalysis) fetchStructureAnalysesByConfig(leftAnalysis);
    if (rightAnalysis && rightAnalysis !== leftAnalysis) fetchStructureAnalysesByConfig(rightAnalysis);
  }, [showStructureAnalysis, leftAnalysis, rightAnalysis, fetchStructureAnalysesByConfig]);

  // Scenes (only when we have a valid timestep)
  const leftScene = useRasterFrame(
    trajectoryId,
    currentTimestep,
    leftAnalysis || undefined,
    leftModel || DEFAULT_MODEL
  );
  const rightScene = useRasterFrame(
    trajectoryId,
    currentTimestep,
    rightAnalysis || undefined,
    rightModel || DEFAULT_MODEL
  );

  const dislLeft = leftAnalysis ? analysisDislocationsById?.[leftAnalysis] : undefined;
  const dislRight = rightAnalysis ? analysisDislocationsById?.[rightAnalysis] : undefined;
  const findDisl = (arr: any[] | undefined, ts?: number) =>
    arr?.find?.((d) => Number.isFinite(d?.timestep) && d.timestep === ts);

  const dislDataLeft = findDisl(dislLeft, currentTimestep);
  const dislDataRight = findDisl(dislRight, currentTimestep);

  // Metrics
  const metricEntries: MetricEntry[] = useMemo(() => {
    const m = trajectoryMetrics as any;
    return [
      { key: 'frames.totalFrames', label: 'Frames', value: formatNumber(m?.frames?.totalFrames), icon: IoTimeOutline },
      { key: 'files.totalSizeBytes', label: 'Size', value: formatSize(m?.files?.totalSizeBytes), icon: IoLayersOutline },
      { key: 'structureAnalysis.totalDocs', label: 'Analyses', value: formatNumber(m?.structureAnalysis?.totalDocs), icon: IoBarChartOutline },
    ];
  }, [trajectoryMetrics]);

  // Handlers
  const handlePlayPause = useCallback(() => setIsPlaying((p) => !p), []);
  const handleGoBack = useCallback(() => navigate('/dashboard'), [navigate]);
  const handleView3D = useCallback(() => trajectory?._id && navigate(`/canvas/${trajectory._id}/`), [trajectory, navigate]);
  const handleSignIn = useCallback(() => navigate('/auth/sign-in'), [navigate]);
  const handleThumbClick = useCallback((i: number) => setFrameIndex(i), []);
  const toggleDisl = useCallback(() => setShowDislocations((v) => !v), []);
  const toggleStruct = useCallback(() => setShowStructureAnalysis((v) => !v), []);

  // Derived props for children
  const playbackControlsProps: PlaybackControlsProps = useMemo(
    () => ({ isPlaying, onPlayPause: handlePlayPause }),
    [isPlaying, handlePlayPause]
  );

  const analysisSelectLeftProps: AnalysisSelectProps = useMemo(
    () => ({ analysesNames: analysesNames || [], selectedAnalysis: leftAnalysis, onAnalysisChange: setLeftAnalysis, isLoading }),
    [analysesNames, leftAnalysis, isLoading]
  );
  const analysisSelectRightProps: AnalysisSelectProps = useMemo(
    () => ({ analysesNames: analysesNames || [], selectedAnalysis: rightAnalysis, onAnalysisChange: setRightAnalysis, isLoading }),
    [analysesNames, rightAnalysis, isLoading]
  );

  const modelRailLeftProps: ModelRailProps = useMemo(
    () => ({
      modelsForCurrentFrame: (modelsLeft || []).map((m) => ({
        frame: currentTimestep ?? 0,
        model: m,
        analysisId: leftAnalysis!,
      })),
      selectedModel: leftModel,
      onModelChange: setLeftModel,
    }),
    [modelsLeft, currentTimestep, leftAnalysis, leftModel]
  );

  const modelRailRightProps: ModelRailProps = useMemo(
    () => ({
      modelsForCurrentFrame: (modelsRight || []).map((m) => ({
        frame: currentTimestep ?? 0,
        model: m,
        analysisId: rightAnalysis!,
      })),
      selectedModel: rightModel,
      onModelChange: setRightModel,
    }),
    [modelsRight, currentTimestep, rightAnalysis, rightModel]
  );

  const getThumbnailScene = useCallback(
    (ts: number): Scene | null => {
      const aid = leftAnalysis || rightAnalysis;
      const model = leftAnalysis ? leftModel : rightModel;
      if (!aid) return null;

      // If the analysis metadata says model is available for ts, mark not loading; else show skeleton.
      const available = analyses?.[aid]?.frames?.[ts]?.availableModels as string[] | undefined;
      const isReady = !!available?.includes(model);
      return { frame: ts, model, analysisId: aid, isLoading: !isReady || ts !== currentTimestep };
    },
    [analyses, leftAnalysis, rightAnalysis, leftModel, rightModel, currentTimestep]
  );

  const canRender = Boolean(
    trajectory?._id &&
      timeline.length &&
      frameIndex >= 0 &&
      (leftAnalysis || rightAnalysis) &&
      currentTimestep !== undefined
  );

  return (
    <main className="raster-view-container">
      <RasterHeader
        trajectory={trajectory}
        isLoading={isLoading}
        onGoBack={handleGoBack}
        onView3D={handleView3D}
        onSignIn={!user ? handleSignIn : undefined}
      />

      <div className="raster-scenes-container" style={{ position: 'relative' }}>
        {isPreloading && (
          <div
            style={{
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
              gap: '0.5rem',
            }}
          >
            <div
              style={{
                width: '12px',
                height: '12px',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            Preloading frames: {preloadProgress}%
          </div>
        )}

        <div className="raster-scenes-top-container" style={{ alignItems: 'stretch', gap: '0.75rem' }}>
          <SceneColumn
            trajectoryId={trajectory?._id}
            scene={canRender ? leftScene.scene ?? null : null}
            dislocationData={dislDataLeft}
            isDislocationsLoading={showDislocations && !!leftAnalysis && !dislDataLeft}
            showDislocations={showDislocations}
            isPlaying={isPlaying}
            isLoading={isLoading || !canRender || leftScene.isLoading}
            playbackControls={playbackControlsProps}
            analysisSelect={analysisSelectLeftProps}
            modelRail={modelRailLeftProps}
            showStructureAnalysis={showStructureAnalysis}
            configId={leftAnalysis || undefined}
            timestep={currentTimestep}
            delay={0}
          />

          <SceneColumn
            trajectoryId={trajectory?._id}
            scene={canRender ? rightScene.scene ?? null : null}
            dislocationData={dislDataRight}
            isDislocationsLoading={showDislocations && !!rightAnalysis && !dislDataRight}
            showDislocations={showDislocations}
            isPlaying={isPlaying}
            isLoading={isLoading || !canRender || rightScene.isLoading}
            playbackControls={playbackControlsProps}
            analysisSelect={analysisSelectRightProps}
            modelRail={modelRailRightProps}
            showStructureAnalysis={showStructureAnalysis}
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
          showDislocations={showDislocations}
          onToggleDislocations={toggleDisl}
          showStructureAnalysis={showStructureAnalysis}
          onToggleStructureAnalysis={toggleStruct}
        />
      </div>
    </main>
  );
};

export default HeadlessRasterizerView;
