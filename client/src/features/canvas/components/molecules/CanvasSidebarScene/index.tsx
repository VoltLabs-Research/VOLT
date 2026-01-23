import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Paragraph from '@/components/primitives/Paragraph';
import Container from '@/components/primitives/Container';
import CursorTooltip from '@/components/atoms/common/CursorTooltip';

import { useEditorStore } from '@/features/canvas/stores/editor';
import { usePluginStore, type RenderableExposure, type ResolvedModifier } from '@/features/plugins/stores/plugin-slice';
import { useAnalysisConfigStore } from '@/features/analysis/stores';

import type { Analysis, Trajectory } from '@/types/models';
import type { IPluginRecord } from '@/features/plugins/types';

import analysisApi from '@/features/analysis/api/analysis';
import '@/features/canvas/components/molecules/CanvasSidebarScene/CanvasSidebarScene.css';
import { computeDifferingConfigFields, DEFAULT_ENTRY } from '@/features/canvas/components/molecules/CanvasSidebarScene/utils';

import AnalysisSearchInput from '@/features/canvas/components/atoms/AnalysisSearchInput';
import BootstrapSkeleton from '@/features/canvas/components/atoms/BootstrapSkeleton';
import DefaultSceneOption from '@/features/canvas/components/molecules/DefaultSceneOption';
import AnalysisTooltipContent from '@/features/canvas/components/molecules/AnalysisTooltipContent';
import AnalysisSection from '@/features/canvas/components/organisms/AnalysisSection';

interface CanvasSidebarSceneProps {
  trajectory?: Trajectory | null;
}

type ExposureLoadState = 'idle' | 'loading' | 'loaded' | 'error';

type ExposureEntry = {
  state: ExposureLoadState;
  exposures: RenderableExposure[];
  error?: unknown;
};

interface AnalysisSectionData {
  analysis: Analysis;
  pluginSlug: string;
  plugin: ResolvedModifier;
  pluginDisplayName: string;
  entry: ExposureEntry;
  isCurrentAnalysis: boolean;
  config: Record<string, any>;
}

const CanvasSidebarScene: React.FC<CanvasSidebarSceneProps> = ({ trajectory }) => {
  // Editor store
  const setActiveScene = useEditorStore((s) => s.setActiveScene);
  const activeScene = useEditorStore((s) => s.activeScene);
  const addScene = useEditorStore((s) => s.addScene);
  const removeScene = useEditorStore((s) => s.removeScene);
  const activeScenes = useEditorStore((s) => s.activeScenes);

  // Plugin store
  const getRenderableExposures = usePluginStore((s) => s.getRenderableExposures);
  const getModifiers = usePluginStore((s) => s.getModifiers);
  const pluginsBySlug = usePluginStore((s) => s.pluginsBySlug);

  // Analysis config
  const analysisConfig = useAnalysisConfigStore((s) => s.analysisConfig);
  const updateAnalysisConfig = useAnalysisConfigStore((s) => s.updateAnalysisConfig);
  const analysisConfigId = analysisConfig?._id;

  // Local state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [bootstrapLoading, setBootstrapLoading] = useState(true);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);

  const [exposureEntries, setExposureEntries] = useState<Map<string, ExposureEntry>>(new Map());
  const exposureEntriesRef = useRef(exposureEntries);
  useEffect(() => { exposureEntriesRef.current = exposureEntries; }, [exposureEntries]);

  const getEntryLatest = useCallback((analysisId: string): ExposureEntry => {
    return exposureEntriesRef.current.get(analysisId) ?? DEFAULT_ENTRY;
  }, []);

  const setEntry = useCallback((analysisId: string, next: ExposureEntry) => {
    setExposureEntries(prev => {
      const m = new Map(prev);
      m.set(analysisId, next);
      return m;
    });
  }, []);

  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [tooltipAnalysis, setTooltipAnalysis] = useState<any | null>(null);
  const [headerPopoverStates, setHeaderPopoverStates] = useState<Map<string, boolean>>(new Map());

  const activeSceneRef = useRef(activeScene);
  useEffect(() => { activeSceneRef.current = activeScene; }, [activeScene]);

  const trajectoryId = trajectory?._id;

  useEffect(() => {
    setExpandedSections(new Set());
    setSearchQuery('');
    setTooltipOpen(false);
    setTooltipAnalysis(null);
    setHeaderPopoverStates(new Map());
    setExposureEntries(new Map());
    setBootstrapLoading(true);
    setAnalyses([]);
  }, [trajectoryId]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setBootstrapLoading(true);

      try {
        if (!trajectoryId) {
          if (!cancelled) setBootstrapLoading(false);
          return;
        }

        const response = await analysisApi.getByTrajectoryId(trajectoryId, { limit: 100 });
        const fetchedRaw = response.data || [];
        
        if (cancelled) return;

        const pluginsToRegister: IPluginRecord[] = [];
        const normalizedAnalyses: Analysis[] = [];

        fetchedRaw.forEach((item: any) => {
          // Flatten nested props if present (backend domain object serialization)
          const props = item.props ? item.props : item;
          const id = item.id || item._id;

          let pluginSlug = '';
          
          if (props.plugin && typeof props.plugin === 'object') {
            // Plugin is fully populated, add to registry
            pluginsToRegister.push(props.plugin);
            pluginSlug = props.plugin.slug;
          } else if (typeof props.plugin === 'string') {
            // Plugin is just a slug or ID
            pluginSlug = props.plugin;
          }

          normalizedAnalyses.push({
            ...props,
            _id: id,
            plugin: pluginSlug
          });
        });

        // Register plugins directly to store to avoid fetching them again
        usePluginStore.getState().registerPlugins(pluginsToRegister);
        
        setAnalyses(normalizedAnalyses);

        if (normalizedAnalyses.length === 0) {
          setBootstrapLoading(false);
          return;
        }
      } catch (e) {
        console.error('[CanvasSidebarScene] bootstrap failed', e);
      } finally {
        if (!cancelled) setBootstrapLoading(false);
      }
    };

    bootstrap();
    return () => { cancelled = true; };
  }, [trajectoryId]);

  const differingConfigByAnalysis = useMemo(() => {
    if (analyses.length === 0) return new Map<string, [string, any][]>();
    return computeDifferingConfigFields(analyses);
  }, [analyses]);

  const loadExposuresForAnalysis = useCallback(async (analysisId: string, pluginSlug: string) => {
    if (!trajectoryId) return;

    const current = getEntryLatest(analysisId);
    if (current.state === 'loading' || current.state === 'loaded') return;

    if (!pluginsBySlug[pluginSlug]) return;

    setEntry(analysisId, { state: 'loading', exposures: [] });

    try {
      const exposures = await getRenderableExposures(trajectoryId, analysisId, 'canvas', pluginSlug);
      setEntry(analysisId, { state: 'loaded', exposures });
    } catch (err) {
      console.error('[CanvasSidebarScene] exposures fetch failed', analysisId, err);
      setEntry(analysisId, { state: 'error', exposures: [], error: err });
    }
  }, [trajectoryId, getRenderableExposures, getEntryLatest, setEntry, pluginsBySlug]);

  useEffect(() => {
    if (!analysisConfigId) return;
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.add(analysisConfigId);
      return next;
    });
  }, [analysisConfigId]);

  useEffect(() => {
    if (!analysisConfigId || analyses.length === 0) return;
    const a = analyses.find(x => x._id === analysisConfigId);
    if (!a) return;
    loadExposuresForAnalysis(a._id, a.plugin);
  }, [analysisConfigId, analyses, loadExposuresForAnalysis]);

  useEffect(() => {
    if (analyses.length === 0) return;
    expandedSections.forEach((analysisId) => {
      const a = analyses.find(x => x._id === analysisId);
      if (!a) return;
      const entry = getEntryLatest(analysisId);
      if (entry.state === 'idle' || entry.state === 'error') {
        loadExposuresForAnalysis(analysisId, a.plugin);
      }
    });
  }, [expandedSections, analyses, getEntryLatest, loadExposuresForAnalysis]);

  // Logic to auto-select exposure when analysis config changes
  useEffect(() => {
    if (!analysisConfigId) return;

    const currentScene = activeSceneRef.current;
    if (!currentScene || currentScene.source !== 'plugin') return;
    if ((currentScene as any).analysisId === analysisConfigId) return;

    const entry = getEntryLatest(analysisConfigId);
    if (entry.state !== 'loaded') return;

    const exposures = entry.exposures;
    const match = exposures.find(ex => ex.exposureId === currentScene.sceneType);

    if (match) {
      setActiveScene({
        sceneType: match.exposureId,
        source: 'plugin',
        analysisId: match.analysisId,
        exposureId: match.exposureId
      });
      return;
    }

    if (exposures.length > 0) {
      const next = exposures[0];
      setActiveScene({
        sceneType: next.exposureId,
        source: 'plugin',
        analysisId: next.analysisId,
        exposureId: next.exposureId
      });
      return;
    }

    setActiveScene({ sceneType: 'trajectory', source: 'default' });
  }, [analysisConfigId, getEntryLatest, setActiveScene]);

  const toggleSection = useCallback((analysisId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(analysisId)) next.delete(analysisId);
      else next.add(analysisId);
      return next;
    });
  }, []);

  const isSceneInActiveScenes = useCallback((scene: any) => {
    return activeScenes.some(s =>
      s.sceneType === scene.sceneType &&
      s.source === scene.source &&
      (s as any).analysisId === (scene as any).analysisId &&
      (s as any).exposureId === (scene as any).exposureId
    );
  }, [activeScenes]);

  const onSelectScene = useCallback((scene: any, analysis?: any) => {
    if (analysis) updateAnalysisConfig(analysis);
    setActiveScene(scene);
  }, [updateAnalysisConfig, setActiveScene]);

  const totalAnalyses = analyses.length || 0;

  const allAnalysisSections = useMemo((): AnalysisSectionData[] => {
    if (analyses.length === 0) return [];

    const modifiers = getModifiers();

    const neededSlugs = new Set(analyses.map(a => a.plugin));
    const modifierBySlug = new Map(modifiers.map(m => [m.pluginSlug, m]));

    for (const slug of neededSlugs) {
      const m = modifierBySlug.get(slug);
      if (!m || !m.name || m.name === slug) {
        return [];
      }
    }

    const sections = analyses.map((analysis) => {
      const mod = modifierBySlug.get(analysis.plugin)!;
      const entry = exposureEntries.get(analysis._id) ?? DEFAULT_ENTRY;

      return {
        analysis,
        pluginSlug: analysis.plugin,
        plugin: mod,
        pluginDisplayName: mod.name,
        entry,
        isCurrentAnalysis: analysis._id === analysisConfigId,
        config: analysis.config || {}
      };
    });

    return sections.sort((a, b) => (a.isCurrentAnalysis ? -1 : b.isCurrentAnalysis ? 1 : 0));
  }, [analyses, getModifiers, exposureEntries, analysisConfigId]);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return allAnalysisSections;
    const q = searchQuery.toLowerCase();
    return allAnalysisSections.filter(s => s.pluginDisplayName.toLowerCase().includes(q));
  }, [allAnalysisSections, searchQuery]);

  // Create callbacks for popovers so they can update state in parent
  const headerPopoverCallbacks = useMemo(() => {
    const map = new Map<string, (isOpen: boolean) => void>();
    filteredSections.forEach(section => {
      map.set(section.analysis._id, (isOpen: boolean) => {
        setHeaderPopoverStates(prev => {
          const next = new Map(prev);
          next.set(section.analysis._id, isOpen);
          return next;
        });
        if (isOpen) {
          setTooltipOpen(false);
          setTooltipAnalysis(null);
        }
      });
    });
    return map;
  }, [filteredSections]);

  const showSectionsSkeleton = bootstrapLoading || (totalAnalyses > 0 && allAnalysisSections.length === 0);

  const setTooltip = useCallback((open: boolean, pos: { x: number, y: number }, content: any | undefined) => {
    if (open !== undefined) setTooltipOpen(open);
    if (pos) setTooltipPos(pos);
    if (content !== undefined) setTooltipAnalysis(content);
  }, []);

  return (
    <div className='editor-sidebar-scene-container p-1-5'>
      <div className='editor-sidebar-scene-options-container d-flex gap-1 column'>
        {/* Default option */}
        <DefaultSceneOption
          onSelect={onSelectScene}
          onAdd={addScene}
          onRemove={removeScene}
          isSceneActive={isSceneInActiveScenes}
        />

        {/* Search */}
        {totalAnalyses > 0 && (
          <AnalysisSearchInput value={searchQuery} onChange={setSearchQuery} />
        )}

        {/* Skeleton */}
        {showSectionsSkeleton && (
          <BootstrapSkeleton count={totalAnalyses} />
        )}

        {/* List */}
        {!showSectionsSkeleton && filteredSections.map((section) => (
          <AnalysisSection
            key={section.analysis._id}
            section={section}
            trajectoryId={trajectoryId!}
            isExpanded={expandedSections.has(section.analysis._id)}
            onToggle={toggleSection}
            differingFields={differingConfigByAnalysis.get(section.analysis._id) || []}
            headerPopoverCallbacks={headerPopoverCallbacks}
            headerPopoverStates={headerPopoverStates}
            onSelectScene={onSelectScene}
            onAddScene={addScene}
            onRemoveScene={removeScene}
            isSceneActive={isSceneInActiveScenes}
            updateAnalysisConfig={updateAnalysisConfig}
          />
        ))}

        {!showSectionsSkeleton && searchQuery && filteredSections.length === 0 && (
          <Paragraph className='color-muted font-size-1 text-center p-1'>
            No analyses match your search
          </Paragraph>
        )}
      </div>

      <CursorTooltip
        isOpen={tooltipOpen}
        x={tooltipPos.x}
        y={tooltipPos.y}
        content={<AnalysisTooltipContent analysis={tooltipAnalysis} />}
      />
    </div>
  );
};

export default CanvasSidebarScene;
