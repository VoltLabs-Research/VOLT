import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatDistanceToNow, formatDuration } from 'date-fns';
import { TbObjectScan, TbSearch } from 'react-icons/tb';
import { MdKeyboardArrowDown, MdKeyboardArrowRight } from 'react-icons/md';
import { Skeleton } from '@mui/material';

import CanvasSidebarOption from '@/components/atoms/scene/CanvasSidebarOption';
import DynamicIcon from '@/components/atoms/common/DynamicIcon';
import ExposureSkeleton from '@/components/atoms/scene/ExposureSkeleton';
import CursorTooltip from '@/components/atoms/common/CursorTooltip';

import Container from '@/components/primitives/Container';
import Paragraph from '@/components/primitives/Paragraph';
import Title from '@/components/primitives/Title';

import Popover from '@/components/molecules/common/Popover';
import PopoverMenuItem from '@/components/atoms/common/PopoverMenuItem';

import { useEditorStore } from '@/stores/slices/editor';
import { usePluginStore, type RenderableExposure, type ResolvedModifier } from '@/stores/slices/plugin/plugin-slice';
import { useAnalysisConfigStore } from '@/stores/slices/analysis';
import { useUIStore } from '@/stores/slices/ui';

import type { Analysis, Trajectory } from '@/types/models';

import './CanvasSidebarScene.css';

interface CanvasSidebarSceneProps {
  trajectory?: Trajectory | null;
}

type ExposureLoadState = 'idle' | 'loading' | 'loaded' | 'error';

type ExposureEntry = {
  state: ExposureLoadState;
  exposures: RenderableExposure[];
  error?: unknown;
};

interface AnalysisSection {
  analysis: Analysis;
  pluginSlug: string;
  plugin: ResolvedModifier;
  pluginDisplayName: string;
  entry: ExposureEntry;
  isCurrentAnalysis: boolean;
  config: Record<string, any>;
}

const DEFAULT_ENTRY: ExposureEntry = { state: 'idle', exposures: [] };

const computeDifferingConfigFields = (
  analyses: { _id: string; plugin: string; config: Record<string, any> }[]
): Map<string, [string, any][]> => {
  const result = new Map<string, [string, any][]>();
  const byPlugin = new Map<string, typeof analyses>();

  for (const a of analyses) {
    const arr = byPlugin.get(a.plugin) || [];
    arr.push(a);
    byPlugin.set(a.plugin, arr);
  }

  for (const [, pluginAnalyses] of byPlugin) {
    if (pluginAnalyses.length <= 1) {
      for (const a of pluginAnalyses) {
        const entries = Object.entries(a.config || {});
        if (entries.length > 0) result.set(a._id, entries);
      }
      continue;
    }

    const allKeys = new Set<string>();
    for (const a of pluginAnalyses) Object.keys(a.config || {}).forEach(k => allKeys.add(k));

    const differingKeys = new Set<string>();
    for (const key of allKeys) {
      const values = pluginAnalyses.map(a => JSON.stringify(a.config?.[key]));
      if (new Set(values).size > 1) differingKeys.add(key);
    }

    for (const a of pluginAnalyses) {
      const entries: [string, any][] = [];
      for (const key of differingKeys) {
        if (a.config && key in a.config) entries.push([key, a.config[key]]);
      }
      if (entries.length > 0) result.set(a._id, entries);
    }
  }

  return result;
};

const formatConfigValue = (value: any): string => {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return `[${value.length}]`;
  if (typeof value === 'object') return '{...}';
  return String(value);
};

const buildArgumentLabelMap = (
  pluginSlug: string,
  getPluginArguments: (slug: string) => { argument: string; label: string }[]
): Map<string, string> => {
  const labelMap = new Map<string, string>();
  const args = getPluginArguments(pluginSlug);
  for (const arg of args) labelMap.set(arg.argument, arg.label);
  return labelMap;
};

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
  const getPluginArguments = usePluginStore((s) => s.getPluginArguments);
  const pluginsBySlug = usePluginStore((s) => s.pluginsBySlug);

  // Analysis config
  const analysisConfig = useAnalysisConfigStore((s) => s.analysisConfig);
  const updateAnalysisConfig = useAnalysisConfigStore((s) => s.updateAnalysisConfig);
  const analysisConfigId = analysisConfig?._id;

  // UI store
  const setResultsViewerData = useUIStore((s) => s.setResultsViewerData);

  // Local state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [bootstrapLoading, setBootstrapLoading] = useState(true);

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
  const [detailsLoadingByAnalysis, setDetailsLoadingByAnalysis] = useState<Map<string, boolean>>(new Map());

  const activeSceneRef = useRef(activeScene);
  useEffect(() => { activeSceneRef.current = activeScene; }, [activeScene]);

  const trajectoryId = trajectory?._id;

  useEffect(() => {
    setExpandedSections(new Set());
    setSearchQuery('');
    setTooltipOpen(false);
    setTooltipAnalysis(null);
    setHeaderPopoverStates(new Map());
    setDetailsLoadingByAnalysis(new Map());
    setExposureEntries(new Map());
    setBootstrapLoading(true);
  }, [trajectoryId]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setBootstrapLoading(true);

      try {
        const analyses = trajectory?.analysis ?? [];
        if (analyses.length === 0) {
          if (!cancelled) setBootstrapLoading(false);
          return;
        }

        const neededSlugs = Array.from(new Set(analyses.map(a => a.plugin)));

        await usePluginStore.getState().fetchPlugins({ page: 1, limit: 200, force: true });

        await Promise.all(
          neededSlugs.map((slug) => usePluginStore.getState().fetchPlugin(slug))
        );
      } catch (e) {
        console.error('[CanvasSidebarScene] bootstrap failed', e);
      } finally {
        if (!cancelled) setBootstrapLoading(false);
      }
    };

    bootstrap();
    return () => { cancelled = true; };
  }, [trajectoryId, trajectory?.analysis]);

  const differingConfigByAnalysis = useMemo(() => {
    if (!trajectory?.analysis) return new Map<string, [string, any][]>();
    return computeDifferingConfigFields(trajectory.analysis);
  }, [trajectory?.analysis]);

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
    if (!analysisConfigId || !trajectory?.analysis) return;
    const a = trajectory.analysis.find(x => x._id === analysisConfigId);
    if (!a) return;
    loadExposuresForAnalysis(a._id, a.plugin);
  }, [analysisConfigId, trajectory?.analysis, loadExposuresForAnalysis]);

  useEffect(() => {
    if (!trajectory?.analysis) return;
    expandedSections.forEach((analysisId) => {
      const a = trajectory.analysis.find(x => x._id === analysisId);
      if (!a) return;
      const entry = getEntryLatest(analysisId);
      if (entry.state === 'idle' || entry.state === 'error') {
        loadExposuresForAnalysis(analysisId, a.plugin);
      }
    });
  }, [expandedSections, trajectory?.analysis, getEntryLatest, loadExposuresForAnalysis]);

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

  const toggleSection = (analysisId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(analysisId)) next.delete(analysisId);
      else next.add(analysisId);
      return next;
    });
  };

  const isSceneInActiveScenes = (scene: any) => {
    return activeScenes.some(s =>
      s.sceneType === scene.sceneType &&
      s.source === scene.source &&
      (s as any).analysisId === (scene as any).analysisId &&
      (s as any).exposureId === (scene as any).exposureId
    );
  };

  const onSelectScene = (scene: any, analysis?: any) => {
    if (analysis) updateAnalysisConfig(analysis);
    setActiveScene(scene);
  };

  const totalAnalyses = trajectory?.analysis?.length || 0;

  const allAnalysisSections = useMemo((): AnalysisSection[] => {
    const analyses = trajectory?.analysis ?? [];
    if (analyses.length === 0) return [];

    const modifiers = getModifiers();

    const neededSlugs = new Set(analyses.map(a => a.plugin));
    const modifierBySlug = new Map(modifiers.map(m => [m.plugin.slug, m]));

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
  }, [trajectory?.analysis, getModifiers, exposureEntries, analysisConfigId]);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return allAnalysisSections;
    const q = searchQuery.toLowerCase();
    return allAnalysisSections.filter(s => s.pluginDisplayName.toLowerCase().includes(q));
  }, [allAnalysisSections, searchQuery]);

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

  console.log('Filtered Sections:', filteredSections)

  const defaultOptions = [{
    Icon: TbObjectScan,
    title: 'Frame Atoms',
    scene: { sceneType: 'trajectory', source: 'default' as const }
  }];

  const showSectionsSkeleton = bootstrapLoading || (totalAnalyses > 0 && allAnalysisSections.length === 0);

  return (
    <div className='editor-sidebar-scene-container'>
      <div className='editor-sidebar-scene-options-container d-flex gap-1 column'>
        {/* Default option */}
        {defaultOptions.map((opt, index) => (
          <div key={`${opt.scene.source}-${opt.scene.sceneType}-${index}`}>
            <Popover
              id={`default-option-menu-${index}`}
              triggerAction="contextmenu"
              trigger={
                <CanvasSidebarOption
                  onSelect={() => onSelectScene(opt.scene)}
                  activeOption={isSceneInActiveScenes(opt.scene)}
                  isLoading={false}
                  option={{ Icon: opt.Icon, title: opt.title, modifierId: '' }}
                />
              }
            >
              <PopoverMenuItem
                onClick={() => addScene(opt.scene)}
                disabled={isSceneInActiveScenes(opt.scene)}
              >
                Add to scene
              </PopoverMenuItem>
              <PopoverMenuItem
                onClick={() => removeScene(opt.scene)}
                disabled={!isSceneInActiveScenes(opt.scene)}
              >
                Remove from scene
              </PopoverMenuItem>
            </Popover>
          </div>
        ))}

        {/* Search */}
        {totalAnalyses > 0 && (
          <Container className='analysis-search-container'>
            <Container className='analysis-search-input-wrapper d-flex items-center gap-05'>
              <TbSearch className='analysis-search-icon' />
              <input
                type='text'
                className='analysis-search-input'
                placeholder='Search analyses...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </Container>
          </Container>
        )}

        {showSectionsSkeleton && (
          <>
            {Array.from({ length: Math.min(3, Math.max(1, totalAnalyses || 1)) }).map((_, i) => (
              <Container key={`bootstrap-skel-${i}`} className='analysis-section'>
                <Container className='analysis-section-header d-flex column gap-05 p-1'>
                  <Container className='d-flex items-center gap-05'>
                    <Skeleton variant="circular" width={16} height={16} />
                    <Skeleton variant="text" width={160} height={24} />
                    <Skeleton variant="text" width={90} height={24} />
                  </Container>
                  <Skeleton variant="text" width={240} height={18} />
                </Container>
                <Container className='analysis-section-content'>
                  <ExposureSkeleton count={2} compact />
                </Container>
              </Container>
            ))}
          </>
        )}

        {!showSectionsSkeleton && filteredSections.map((section) => {
          const isExpanded = expandedSections.has(section.analysis._id);
          const headerPopoverOpen = headerPopoverStates.get(section.analysis._id) || false;
          const handleHeaderPopoverChange = headerPopoverCallbacks.get(section.analysis._id)!;

          const analysis = trajectory?.analysis?.find(a => a._id === section.analysis._id);

          const differingFields = differingConfigByAnalysis.get(section.analysis._id) || [];
          const labelMap = buildArgumentLabelMap(section.pluginSlug, getPluginArguments);
          const configDescription = differingFields
            .map(([key, value]) => `${labelMap.get(key) || key}: ${formatConfigValue(value)}`)
            .join(', ');

          const detailsLoading = detailsLoadingByAnalysis.get(section.analysis._id) || false;

          const entry = section.entry;
          const isLoaded = entry.state === 'loaded';

          return (
            <Container key={section.analysis._id} className='analysis-section'>
              <Popover
                id={`analysis-header-menu-${section.analysis._id}`}
                triggerAction="contextmenu"
                onOpenChange={handleHeaderPopoverChange}
                trigger={
                  <Container
                    className='analysis-section-header d-flex column cursor-pointer'
                    onClick={() => toggleSection(section.analysis._id)}
                    onMouseEnter={(e: React.MouseEvent) => {
                      if (headerPopoverOpen) return;
                      const rect = (e.currentTarget as Element).getBoundingClientRect();
                      setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });

                      const durationMs = section.analysis.finishedAt && section.analysis.startedAt
                        ? new Date(section.analysis.finishedAt).getTime() - new Date(section.analysis.startedAt).getTime()
                        : null;

                      setTooltipAnalysis({ ...section, duration: durationMs });
                      setTooltipOpen(true);
                    }}
                    onMouseLeave={() => {
                      if (!headerPopoverOpen) {
                        setTooltipOpen(false);
                        setTooltipAnalysis(null);
                      }
                    }}
                    onMouseMove={(e: React.MouseEvent) => {
                      if (!headerPopoverOpen) setTooltipPos({ x: e.clientX, y: e.clientY });
                    }}
                  >
                    <Container className='d-flex items-center gap-05'>
                      <i
                        className='analysis-section-arrow'
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSection(section.analysis._id);
                        }}
                      >
                        {isExpanded ? <MdKeyboardArrowDown /> : <MdKeyboardArrowRight />}
                      </i>

                      <Paragraph
                        className={`analysis-section-title font-size-2 ${section.isCurrentAnalysis ? 'color-gray' : 'color-secondary'}`}
                      >
                        {section.pluginDisplayName}
                        {section.isCurrentAnalysis && ' (Active)'}
                        {analysis?.createdAt && (
                          <span className='analysis-section-date'>
                            {' • '}{formatDistanceToNow(new Date(analysis.createdAt), { addSuffix: true })}
                          </span>
                        )}
                      </Paragraph>
                    </Container>

                    {configDescription && (
                      <Paragraph className='analysis-section-description color-tertiary font-size-1'>
                        {configDescription}
                      </Paragraph>
                    )}
                  </Container>
                }
              >
                <PopoverMenuItem
                  isLoading={detailsLoading}
                  onClick={async () => {
                    if (!trajectoryId) return;

                    setDetailsLoadingByAnalysis(prev => {
                      const next = new Map(prev);
                      next.set(section.analysis._id, true);
                      return next;
                    });

                    try {
                      // Use getAllExposures for results viewer (no context/canvas/raster filtering)
                      const allExposures = await usePluginStore.getState().getAllExposures(
                        trajectoryId,
                        section.analysis._id,
                        section.pluginSlug
                      );

                      setResultsViewerData({
                        pluginSlug: section.pluginSlug,
                        pluginName: section.pluginDisplayName,
                        analysisId: section.analysis._id,
                        exposures: allExposures
                      });
                    } finally {
                      setDetailsLoadingByAnalysis(prev => {
                        const next = new Map(prev);
                        next.set(section.analysis._id, false);
                        return next;
                      });
                    }
                  }}
                >
                  View details
                </PopoverMenuItem>
              </Popover>

              {isExpanded && !isLoaded && (
                <Container className='analysis-section-content'>
                  <ExposureSkeleton count={3} compact />
                </Container>
              )}

              {isExpanded && entry.state === 'error' && (
                <Paragraph className='analysis-section-empty text-center color-muted font-size-1'>
                  Failed to load visualizers
                </Paragraph>
              )}

              {isExpanded && isLoaded && entry.exposures.length > 0 && (
                <Container className='analysis-section-content d-flex column gap-05'>
                  {entry.exposures.map((exposure, index) => {
                    const sceneObject = {
                      sceneType: exposure.exposureId,
                      source: 'plugin' as const,
                      analysisId: exposure.analysisId,
                      exposureId: exposure.exposureId
                    };

                    const Icon = () => (
                      exposure.icon ? <DynamicIcon iconName={exposure.icon} /> : <TbObjectScan />
                    );

                    return (
                      <div key={`${exposure.exposureId}-${index}`}>
                        <Popover
                          id={`exposure-option-menu-${section.analysis._id}-${index}`}
                          triggerAction="contextmenu"
                          trigger={
                            <CanvasSidebarOption
                              onSelect={() => onSelectScene(sceneObject, analysis as any)}
                              activeOption={isSceneInActiveScenes(sceneObject)}
                              isLoading={false}
                              option={{
                                Icon,
                                title: exposure.name || exposure.exposureId,
                                modifierId: exposure.modifierId || ''
                              }}
                            />
                          }
                        >
                          <PopoverMenuItem
                            onClick={() => {
                              if (analysis) updateAnalysisConfig(analysis as any);
                              addScene(sceneObject);
                            }}
                            disabled={isSceneInActiveScenes(sceneObject)}
                          >
                            Add to scene
                          </PopoverMenuItem>
                          <PopoverMenuItem
                            onClick={() => removeScene(sceneObject)}
                            disabled={!isSceneInActiveScenes(sceneObject)}
                          >
                            Remove from scene
                          </PopoverMenuItem>
                        </Popover>
                      </div>
                    );
                  })}
                </Container>
              )}

              {isExpanded && isLoaded && entry.exposures.length === 0 && (
                <Paragraph className='analysis-section-empty text-center color-muted font-size-1'>
                  No visualizations available
                </Paragraph>
              )}
            </Container>
          );
        })}

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
        content={
          tooltipAnalysis && (
            <Container className='analysis-tooltip-content'>
              <Container className='analysis-tooltip-header-container d-flex column gap-05'>
                <Title className='font-weight-4 font-size-3 d-flex gap-05'>
                  <span>{tooltipAnalysis.pluginDisplayName}</span>
                  {tooltipAnalysis.duration != null && (
                    <span className='color-muted'>
                      {' • '}
                      {formatDuration({ seconds: Math.floor(tooltipAnalysis.duration / 1000) })}
                    </span>
                  )}
                </Title>

                {tooltipAnalysis.plugin?.plugin?.modifier?.description && (
                  <Paragraph className='color-tertiary font-size-1'>
                    {tooltipAnalysis.plugin?.plugin?.modifier?.description}
                  </Paragraph>
                )}
              </Container>

              <Container className='analysis-tooltip-tables d-flex gap-2'>
                {tooltipAnalysis.config && Object.keys(tooltipAnalysis.config).length > 0 && (
                  <Container className='analysis-tooltip-grid'>
                    {Object.entries(tooltipAnalysis.config).map(([key, value]) => {
                      const argDef = tooltipAnalysis.plugin?.plugin?.arguments?.find((arg: any) => arg.argument === key);
                      const label = argDef?.label || key;

                      return (
                        <React.Fragment key={key}>
                          <span className='color-muted font-size-1'>{label}</span>
                          <span className='color-secondary font-size-1 font-weight-5'>
                            {formatConfigValue(value)}
                          </span>
                        </React.Fragment>
                      );
                    })}
                  </Container>
                )}

                <Container className='analysis-tooltip-grid'>
                  <span className='color-muted font-size-1'>Exposures</span>
                  <span className='color-secondary font-size-1 font-weight-5'>
                    {tooltipAnalysis.entry?.exposures?.length || 0}
                  </span>

                  <span className='color-muted font-size-1'>Completed Frames</span>
                  <span className='color-secondary font-size-1 font-weight-5'>
                    {tooltipAnalysis.analysis.completedFrames}
                  </span>

                  {tooltipAnalysis.analysis.clusterId && (
                    <>
                      <span className='color-muted font-size-1'>Cluster</span>
                      <span className='color-secondary font-size-1 font-weight-5'>
                        {tooltipAnalysis.analysis.clusterId}
                      </span>
                    </>
                  )}

                  <span className='color-muted font-size-1'>Created</span>
                  <span className='color-secondary font-size-1 font-weight-5'>
                    {formatDistanceToNow(new Date(tooltipAnalysis.analysis.createdAt), { addSuffix: true })}
                  </span>
                </Container>
              </Container>
            </Container>
          )
        }
      />
    </div>
  );
};

export default CanvasSidebarScene;
