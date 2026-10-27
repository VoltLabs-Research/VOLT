import { normalizeCanvasAnalysisStatus } from '../../utils/analysis-status';

import type { AnalysisSectionData } from '../../utils/sidebar-scene-sections';
import type { CanvasAnalysisStatus, CanvasAnalysisStatusEntry } from '../../utils/analysis-status';

// Keys of what the pipeline list can select; the property editor below renders the selected one.
export const panelItemKey = {
    trajectory: 'trajectory',
    cell: 'simulation-cell',
    source: 'data-source',
    exposure: (analysisId: string, exposureId: string): string => `exposure:${analysisId}:${exposureId}`,
    analysis: (analysisId: string): string => `analysis:${analysisId}`,
    context: (rowKey: string): string => `context:${rowKey}`,
    stage: (stageId: string): string => `stage:${stageId}`
} as const;

// Draft stages, a run's analyses and its other stages: the modifications, as opposed to visual elements and the source.
export const isModifierKey = (key: string): boolean =>
    key.startsWith('stage:') || key.startsWith('analysis:') || key.startsWith('context:');

export const analysisStatus = (
    section: AnalysisSectionData,
    statusMap: Map<string, CanvasAnalysisStatusEntry>
): CanvasAnalysisStatus | undefined =>
    statusMap.get(section.analysis._id)?.status ?? normalizeCanvasAnalysisStatus(section.analysis.status);
