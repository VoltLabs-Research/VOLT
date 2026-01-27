import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import Paragraph from '@/shared/presentation/components/primitives/Paragraph';
import Container from '@/shared/presentation/components/primitives/Container';
import CursorTooltip from '@/shared/presentation/components/atoms/common/CursorTooltip';

import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import { usePluginStore } from '@/modules/plugins/presentation/stores/plugin-slice';
import { useAnalysisStore } from '@/modules/analysis/presentation/stores';
import { useAnalysisConfigsByTrajectory } from '@/modules/analysis/presentation/hooks/use-analysis-queries';
import { usePluginExposures } from '@/modules/plugins/presentation/hooks/use-plugin-queries';

import type { Analysis, Trajectory } from '@/types/models';
import type { IPluginRecord } from '@/modules/plugins/domain/types';

import '@/modules/canvas/presentation/components/molecules/CanvasSidebarScene/CanvasSidebarScene.css';
import { computeDifferingConfigFields } from '@/modules/canvas/presentation/components/molecules/CanvasSidebarScene/utils';

import AnalysisSearchInput from '@/modules/canvas/presentation/components/atoms/AnalysisSearchInput';
import BootstrapSkeleton from '@/modules/canvas/presentation/components/atoms/BootstrapSkeleton';
import DefaultSceneOption from '@/modules/canvas/presentation/components/molecules/DefaultSceneOption';
import AnalysisTooltipContent from '@/modules/canvas/presentation/components/molecules/AnalysisTooltipContent';
import AnalysisSection from '@/modules/canvas/presentation/components/organisms/AnalysisSection';

interface CanvasSidebarSceneProps {
  trajectory?: Trajectory | null;
}

const CanvasSidebarScene: React.FC<CanvasSidebarSceneProps> = ({ trajectory }) => {
  // Editor store
  const setActiveScene = useEditorStore((s) => s.setActiveScene);
  const activeScene = useEditorStore((s) => s.activeScene);
  const addScene = useEditorStore((s) => s.addScene);
  const removeScene = useEditorStore((s) => s.removeScene);
  const activeScenes = useEditorStore((s) => s.activeScenes);

  // Plugin store
  const modifiers = usePluginStore((s) => s.modifiers);
  const registerPlugins = usePluginStore((s) => s.registerPlugins);

  // Analysis config
  const analysisConfig = useAnalysisStore((s) => s.analysisConfig);
  const updateAnalysisConfig = useAnalysisStore((s) => s.updateAnalysisConfig);
  const analysisConfigId = analysisConfig?._id;

  // Local state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [tooltipAnalysis, setTooltipAnalysis] = useState<any | null>(null);
  const [headerPopoverStates, setHeaderPopoverStates] = useState<Map<string, boolean>>(new Map());

  const activeSceneRef = useRef(activeScene);
  useEffect(() => { activeSceneRef.current = activeScene; }, [activeScene]);

  const trajectoryId = trajectory?._id;
  const { data: analysesResponse, isLoading: isAnalysesLoading } = useAnalysisConfigsByTrajectory(trajectoryId, 100);

  // Hook for active analysis exposures (for auto-selection)
  const { exposures: activeExposures, isLoading: isActiveExposuresLoading } = usePluginExposures({
    analysisId: analysisConfigId,
    context: 'canvas'
  });

  const analyses = useMemo(() => {
    const fetchedRaw = analysesResponse?.data ?? [];
    const pluginsToRegister: IPluginRecord[] = [];
    const normalizedAnalyses: Analysis[] = [];

    fetchedRaw.forEach((item: any) => {
      const props = item.props ? item.props : item;
      const id = item.id || item._id;

      let pluginSlug = '';

      if (props.plugin && typeof props.plugin === 'object') {
        pluginsToRegister.push(props.plugin);
        pluginSlug = props.plugin.slug;
      } else if (typeof props.plugin === 'string') {
        pluginSlug = props.plugin;
      }

      normalizedAnalyses.push({
        ...props,
        _id: id,
        plugin: pluginSlug
      });
    });

    if (pluginsToRegister.length > 0) {
      registerPlugins(pluginsToRegister);
    }

    return normalizedAnalyses;
  }, [analysesResponse, registerPlugins]);

  const differingConfigByAnalysis = useMemo(() => {
    if (analyses.length === 0) return new Map<string, [string, any][]>();
    return computeDifferingConfigFields(analyses);
  }, [analyses]);

  useEffect(() => {
    if (!analysisConfigId) return;
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (!next.has(analysisConfigId)) {
        next.add(analysisConfigId);
        return next;
      }
      return prev;
    });
  }, [analysisConfigId]);

  // Logic to auto-select exposure when analysis config changes
  useEffect(() => {
    if (!analysisConfigId || isActiveExposuresLoading) return;

    const currentScene = activeSceneRef.current;
    if (!currentScene || currentScene.source !== 'plugin') return;
    if ((currentScene as any).analysisId === analysisConfigId) return;

    const exposures = activeExposures;
    const match = exposures.find(ex => ex.exposureId === currentScene.sceneType);

    if (match) {
      setActiveScene({
        sceneType: match.exposureId,
        source: 'plugin',
        analysisId: match.analysisId!,
        exposureId: match.exposureId
      });
      return;
    }

    if (exposures.length > 0) {
      const next = exposures[0];
      setActiveScene({
        sceneType: next.exposureId,
        source: 'plugin',
        analysisId: next.analysisId!,
        exposureId: next.exposureId
      });
      return;
    }

    // Default to trajectory view if no exposures available
    setActiveScene({ sceneType: 'trajectory', source: 'default' });
  }, [analysisConfigId, activeExposures, isActiveExposuresLoading, setActiveScene]);

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

  const allAnalysisSections = useMemo(() => {
    if (analyses.length === 0) return [];

    const modifierBySlug = new Map(modifiers.map(m => [m.pluginSlug, m]));

    // Only include analyses for which we have modifiers
    return analyses.map((analysis) => {
      const mod = modifierBySlug.get(analysis.plugin);
      if (!mod) return null;

      return {
        analysis,
        pluginSlug: analysis.plugin,
        pluginDisplayName: mod.name,
        isCurrentAnalysis: analysis._id === analysisConfigId
      };
    }).filter(Boolean);
  }, [analyses, modifiers, analysisConfigId]);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return allAnalysisSections;
    const q = searchQuery.toLowerCase();
    return allAnalysisSections.filter(s => s!.pluginDisplayName.toLowerCase().includes(q));
  }, [allAnalysisSections, searchQuery]);

  // Create callbacks for popovers
  const headerPopoverCallbacks = useMemo(() => {
    const map = new Map<string, (isOpen: boolean) => void>();
    filteredSections.forEach(section => {
      if (!section) return;
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

  const showSectionsSkeleton = isAnalysesLoading || (analyses.length > 0 && allAnalysisSections.length === 0);

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
        {analyses.length > 0 && (
          <AnalysisSearchInput value={searchQuery} onChange={setSearchQuery} />
        )}

        {/* Skeleton */}
        {showSectionsSkeleton && (
          <BootstrapSkeleton count={analyses.length || 3} />
        )}

        {/* List */}
        {!showSectionsSkeleton && filteredSections.map((section: any) => (
          <AnalysisSection
            key={section.analysis._id}
            analysis={section.analysis}
            pluginSlug={section.pluginSlug}
            pluginDisplayName={section.pluginDisplayName}
            isCurrentAnalysis={section.isCurrentAnalysis}
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
