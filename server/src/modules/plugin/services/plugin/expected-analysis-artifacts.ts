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

/**
 * Builds the list of artifacts a run is expected to produce.
 *
 * `config` carries the run's argument values, which decide the outcome of each exposure's
 * `exportWhen` gate. An exposure the run turned off is dropped here rather than marked,
 * so the UI never shows a row that will sit at `pending` forever. Callers without argument
 * values get every exposure, which is the pre-gating behaviour.
 */
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

    /*
     * The primary is picked after gating, so a disabled glb export can never be named
     * primary for a run that will not produce it.
     */
    const primaryIndex = artifacts.findIndex((artifact) => artifact.exportType === 'glb');
    const selectedPrimaryIndex = primaryIndex >= 0 ? primaryIndex : 0;

    return artifacts.map((artifact, index) => ({
        ...artifact,
        isPrimary: index === selectedPrimaryIndex
    }));
};
