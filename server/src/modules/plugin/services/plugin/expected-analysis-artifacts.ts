import type { Plugin } from '@modules/plugin/contracts/plugin';
import type { AnalysisExpectedArtifact } from '@shared/contracts/types/AnalysisProps';

const EXPECTED_ARTIFACT_EXPORTERS = new Set([
    'AtomisticExporter',
    'MeshExporter',
    'LineExporter',
    'ChartExporter'
]);

/**
 * The artifacts a plugin is expected to produce, so the UI can show placeholders
 * before the daemon reports them. A GLB artifact is the preferred primary
 * because it is the one the canvas renders; otherwise the first one wins.
 */
export const resolveExpectedArtifacts = (plugin: Plugin): AnalysisExpectedArtifact[] => {
    const artifacts = (plugin.props.exposures ?? [])
        .filter((exposure) => EXPECTED_ARTIFACT_EXPORTERS.has(exposure.export?.exporter ?? ''))
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
