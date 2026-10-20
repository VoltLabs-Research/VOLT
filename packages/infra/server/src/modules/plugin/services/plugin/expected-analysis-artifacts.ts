import { matchesArgumentCondition } from '@modules/plugin/services/plugin/ArgumentVisibility';
import type { Plugin } from '@modules/plugin/contracts/plugin';
import type { AnalysisExpectedArtifact } from '@shared/contracts/types/AnalysisProps';

const EXPECTED_ARTIFACT_EXPORTERS = new Set([
    'AtomisticExporter',
    'MeshExporter',
    'LineExporter',
    'ChartExporter'
]);

type ArgumentValueMap = Record<string, unknown>;

export const resolveExpectedArtifacts = (
    plugin: Plugin,
    config: ArgumentValueMap = {}
): AnalysisExpectedArtifact[] => {
    const argumentDefinitions = plugin.props.arguments ?? [];

    const artifacts = (plugin.props.exposures ?? [])
        .filter((exposure) => EXPECTED_ARTIFACT_EXPORTERS.has(exposure.export?.exporter ?? ''))
        .filter((exposure) => matchesArgumentCondition(exposure.exportWhen, argumentDefinitions, config))
        .map((exposure): AnalysisExpectedArtifact => ({
            exposureId: exposure._id,
            name: exposure.name || exposure._id,
            pluginId: plugin._id,
            exporter: exposure.export?.exporter,
            exportType: exposure.export?.type,
            status: 'pending'
        }));

    const primaryIndex = artifacts.findIndex((artifact) => artifact.exportType === 'glb');
    const selectedPrimaryIndex = primaryIndex >= 0 ? primaryIndex : 0;

    return artifacts.map((artifact, index) => ({
        ...artifact,
        isPrimary: index === selectedPrimaryIndex
    }));
};
