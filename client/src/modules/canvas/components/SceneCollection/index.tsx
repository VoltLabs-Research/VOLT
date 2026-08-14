import AnalysisTreeNode from '../AnalysisTreeNode';
import PipelineRunTreeNode, { CachedBadge } from '../PipelineRunTreeNode';
import { resolveAnalysisPluginId } from '@/modules/analysis/utils/resolve-plugin-id';
import { resolvePluginSceneRenderMetadata } from '../../utils/plugin-exposure-export';
import { computeRunActivityStatus } from '../../utils/analysis-status-selectors';
import { normalizeCanvasAnalysisStatus } from '../../utils/analysis-status';
import { getSceneKey } from '@/modules/fractal/utils/scene-utils';
import usePluginSelectors from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import {
    CanvasTreeRow,
    CanvasTreeSkeletonRows,
    MaybeContextMenu
} from '../CanvasTree';
import {
    buildAddRemoveOption,
    buildColorSubmenu,
    buildTransparencySubmenu,
    colorOption,
    transparencyOption
} from '../../utils/tree-menus';

import { Atom, Box } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AnalysisSectionData } from '../../utils/sidebar-scene-sections';
import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { PipelineRun } from '@volt/contracts/modules/plugin/pipeline-run';
import type { PipelineRunSection } from '../../utils/pipeline-run-sections';
import type { CanvasAnalysisStatus, CanvasAnalysisStatusEntry } from '../../utils/analysis-status';
import type { AnalysisActivityTone } from '../../hooks/use-analysis-activity-tone';
import type { MenuOption } from '@/shared/contracts/menu';
import type { SceneObjectType, SceneVisualOverrides } from '@/modules/fractal/contracts/scene';
import Scrollable from '@/shared/ui/components/Scrollable';

interface SceneCollectionProps {
    /** Analyses already grouped by the run that produced them, newest run first. */
    runSections: PipelineRunSection[];
    onRestoreRun?: (run: PipelineRun) => void;
    onRenameRun?: (run: PipelineRun, name: string) => void;
    onDeleteRun?: (run: PipelineRun) => void;
    expandedSections: Set<string>;
    toggleSection: (id: string) => void;
    showSectionsSkeleton: boolean;
    activeScene: SceneObjectType | null;
    onSelectScene: (scene: SceneObjectType, analysis?: Analysis) => void;
    isSceneInActiveScenes: (scene: SceneObjectType) => boolean;
    addScene: (scene: SceneObjectType) => void;
    removeScene: (scene: SceneObjectType) => void;
    totalAnalyses: number;
    statusMap: Map<string, CanvasAnalysisStatusEntry>;
    toneByAnalysisId?: Map<string, AnalysisActivityTone>;
    onDeleteAnalysis: (analysisId: string) => Promise<void>;
    onDownloadAnalysis: (analysisId: string) => void | Promise<void>;
    onDownloadExposureListing?: (params: {
        pluginId: string;
        exposureId: string;
        analysisId?: string;
        trajectoryId?: string;
        exposureName?: string;
    }) => void;
    onRetryLoadExposures?: (analysisId: string) => void;
    showDefaultScene?: boolean;
    showSimulationCell?: boolean;
    onToggleSimulationCell?: () => void;
    sceneVisualOverrides?: SceneVisualOverrides;
    setSceneOpacity?: (sceneKey: string, opacity: number) => void;
    setSceneLineWidth?: (sceneKey: string, lineWidth: number) => void;
    setSceneColor?: (sceneKey: string, color: string | undefined) => void;
    setSceneEdges?: (sceneKey: string, edges: boolean) => void;
    firstAnalysisTourTargetId?: string;
    firstExposureTourTargetId?: string;
}

const TREE_SCENE_ICON_COLOR = 'var(--accent)';

const SceneCollection = ({
    runSections,
    onRestoreRun,
    onRenameRun,
    onDeleteRun,
    expandedSections,
    toggleSection,
    showSectionsSkeleton,
    activeScene,
    onSelectScene,
    isSceneInActiveScenes,
    addScene,
    removeScene,
    totalAnalyses,
    statusMap,
    toneByAnalysisId,
    onDeleteAnalysis,
    onDownloadAnalysis,
    onDownloadExposureListing,
    onRetryLoadExposures,
    showDefaultScene = true,
    showSimulationCell = true,
    onToggleSimulationCell,
    sceneVisualOverrides = {},
    setSceneOpacity,
    setSceneLineWidth,
    setSceneColor,
    setSceneEdges,
    firstAnalysisTourTargetId,
    firstExposureTourTargetId
}: SceneCollectionProps) => {
    const { pluginsById } = usePluginSelectors();

    const resolveRunStatus = (runSection: PipelineRunSection): CanvasAnalysisStatus | undefined =>
        computeRunActivityStatus(runSection.analysisSections.map((analysisSection) =>
            statusMap.get(analysisSection.analysis._id)?.status
            ?? normalizeCanvasAnalysisStatus(analysisSection.analysis.status)
        ));

    const firstAnalysisId = runSections
        .flatMap((runSection) => runSection.analysisSections)[0]?.analysis._id;

    const renderAnalysisNode = (
        section: AnalysisSectionData,
        { key, badge }: { key: string; badge?: ReactNode }
    ) => {
        const isFirstAnalysis = section.analysis._id === firstAnalysisId;

        return (
            <AnalysisTreeNode
                key={key}
                section={section}
                indent='lg'
                badge={badge}
                status={statusMap.get(section.analysis._id)?.status}
                tone={toneByAnalysisId?.get(section.analysis._id)}
                isExpanded={expandedSections.has(section.analysis._id)}
                onToggle={toggleSection}
                onSelectScene={onSelectScene}
                isSceneActive={isSceneInActiveScenes}
                onAddScene={addScene}
                onRemoveScene={removeScene}
                onDeleteAnalysis={onDeleteAnalysis}
                onDownloadAnalysis={onDownloadAnalysis}
                onDownloadExposureListing={onDownloadExposureListing}
                onRetryLoadExposures={onRetryLoadExposures}
                sceneVisualOverrides={sceneVisualOverrides}
                setSceneOpacity={setSceneOpacity ?? (() => undefined)}
                setSceneLineWidth={setSceneLineWidth ?? (() => undefined)}
                setSceneColor={setSceneColor ?? (() => undefined)}
                setSceneEdges={setSceneEdges ?? (() => undefined)}
                resolveSceneRenderMetadata={(pluginId, exposureId) => {
                    return resolvePluginSceneRenderMetadata(pluginsById[pluginId], exposureId);
                }}
                plugin={pluginsById[resolveAnalysisPluginId(section.analysis)]}
                pluginsById={pluginsById}
                tourTargetId={isFirstAnalysis ? firstAnalysisTourTargetId : undefined}
                firstExposureTourTargetId={isFirstAnalysis ? firstExposureTourTargetId : undefined}
            />
        );
    };

    const defaultScene = {
        sceneType: 'trajectory',
        source: 'default' as const
    };
    const isDefaultActive = activeScene?.source === 'default';

    const defaultSceneKey = getSceneKey(defaultScene);
    const defaultOpacity = sceneVisualOverrides[defaultSceneKey]?.opacity ?? 1;
    const simulationCellKey = 'simulation-cell';
    const simulationCellOpacity = sceneVisualOverrides[simulationCellKey]?.opacity ?? 1;

    const defaultSceneOptions: MenuOption[] = [
        buildAddRemoveOption({
            isActive: !!isDefaultActive,
            onAdd: () => addScene(defaultScene),
            onRemove: () => removeScene(defaultScene)
        }),
        transparencyOption(buildTransparencySubmenu(defaultOpacity, (value: number) => setSceneOpacity?.(defaultSceneKey, value))),
        colorOption(buildColorSubmenu(sceneVisualOverrides[defaultSceneKey]?.color, (value) => setSceneColor?.(defaultSceneKey, value)))
    ];

    const simulationCellOptions: MenuOption[] = [
        buildAddRemoveOption({
            isActive: !!showSimulationCell,
            onAdd: () => onToggleSimulationCell?.(),
            onRemove: () => onToggleSimulationCell?.()
        }),
        transparencyOption(buildTransparencySubmenu(simulationCellOpacity, (value: number) => setSceneOpacity?.(simulationCellKey, value)))
    ];

    const trajectoryRow = (
        <CanvasTreeRow
            isActive={!!isDefaultActive}
            icon={<Atom style={{
                width: 13,
                height: 13,
                color: TREE_SCENE_ICON_COLOR
            }} />}
            label='Trajectory'
            onClick={() => onSelectScene(defaultScene)}
        />
    );

    const simulationCellRow = (
        <CanvasTreeRow
            isActive={showSimulationCell}
            icon={<Box style={{
                width: 13,
                height: 13,
                color: TREE_SCENE_ICON_COLOR
            }} />}
            label='Simulation Cell'
            onClick={onToggleSimulationCell}
        />
    );

    return (
        <Scrollable className='canvas-tree-container flex flex-col gap-1 px-2 pb-2.5 pt-1.5' role='tree' aria-label='Scene hierarchy'>
            {showDefaultScene && (
                <MaybeContextMenu enabled id='canvas-ctx-default-scene' options={defaultSceneOptions}>
                    {trajectoryRow}
                </MaybeContextMenu>
            )}

            {showDefaultScene && (
                <MaybeContextMenu enabled={true} id='canvas-ctx-simulation-cell' options={simulationCellOptions}>
                    {simulationCellRow}
                </MaybeContextMenu>
            )}

            {showSectionsSkeleton && (
                <CanvasTreeSkeletonRows count={Math.min(Math.max(totalAnalyses, 1), 3)} />
            )}

            {!showSectionsSkeleton && runSections.map((runSection) => (
                <PipelineRunTreeNode
                    key={runSection.runId}
                    section={runSection}
                    isExpanded={expandedSections.has(runSection.runId)}
                    onToggle={toggleSection}
                    status={resolveRunStatus(runSection)}
                    onRestore={onRestoreRun}
                    onRename={onRenameRun}
                    onDelete={onDeleteRun}
                    renderAnalysisRow={(row) => renderAnalysisNode(row.section, {
                        key: row.key,
                        badge: row.cacheHit ? <CachedBadge /> : undefined
                    })}
                />
            ))}
        </Scrollable>
    );
};

export default SceneCollection;
