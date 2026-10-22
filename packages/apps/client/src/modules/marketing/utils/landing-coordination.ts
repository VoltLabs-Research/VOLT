import { LANDING_CLUSTER_ID, LANDING_TEAM_ID, LANDING_USER, hoursAgo } from '@/modules/marketing/utils/landing-workspace';
import { SAMPLE_ATOMS, SAMPLE_TIMESTEPS, SHEAR_DEFORMATION_ID } from '@/modules/marketing/utils/landing-trajectories';

export const COORDINATION_PLUGIN_ID = 'landing-coordination-plugin';
export const COORDINATION_ANALYSIS_ID = 'landing-coordination';
export const COORDINATION_RUN_ID = 'landing-coordination-run';
export const COORDINATION_PRIMARY_EXPOSURE_ID = 'primary-exposure';
export const COORDINATION_MODEL_EXPOSURE_ID = 'coordination-model-exposure';

// What the analysis ran with: the cutoff its numbers on the landing were computed at.
export const COORDINATION_CONFIG = { cutoff: 3.0, rdf_bins: 500 };

const MODIFIER = {
    name: 'Coordination Analysis',
    key: 'coordination-analysis',
    icon: 'HiCube',
    author: 'Rodolfo Herrera',
    license: 'MIT',
    version: '2.0.5',
    homepage: 'https://github.com/voltlabs-research/coordination-analysis',
    description: 'Analyzes local atomic coordination by computing coordination numbers, the radial distribution function (RDF), and per-type-pair partial RDF histograms.'
};

const ARGUMENTS = [
    { argument: 'cutoff', type: 'number', label: 'Cutoff', default: 3.2, min: 0, step: 0.1 },
    { argument: 'rdf_bins', type: 'number', label: 'RDF Bins', default: 500, min: 1, step: 1 }
];

const COORDINATION_MODEL_EXPORT = { exporter: 'AtomisticExporter', type: 'glb' };

const RDF_CHART_EXPORT = {
    exporter: 'ChartExporter',
    type: 'chart-png',
    options: {
        xAxisKey: 'rdf.r',
        yAxisKey: 'rdf.g_r',
        chartType: 'line',
        title: 'Radial distribution function',
        xAxisLabel: 'r',
        yAxisLabel: 'g(r)',
        backgroundColor: '#ffffff',
        lineColor: '#2563eb',
        fillColor: 'rgba(37, 99, 235, 0.35)',
        showLegend: false,
        showGrid: true
    }
};

// The builder draws the workflow top to bottom on its screen, through the top and bottom of
// each node: every step centered under the one before it, the exposures side by side under
// the entrypoint, and each export under its exposure. A node's x is the center of its column
// less half the width the builder draws it at.
const TOP_TO_BOTTOM = { input: { side: 'top', offset: 50 }, output: { side: 'bottom', offset: 50 } };

const node = (id: string, type: string, x: number, y: number, data: Record<string, unknown>) => ({
    id,
    type,
    position: { x, y },
    data: { ...data, connectorLayout: TOP_TO_BOTTOM }
});

const edge = (id: string, source: string, target: string) => ({ id, source, sourceHandle: 'output', target, targetHandle: 'input' });

// The workflow its plugin.json defines, laid out for the screen.
export const COORDINATION_WORKFLOW = {
    nodes: [
        node('plugin-metadata', 'modifier', 411, 0, { modifier: MODIFIER }),
        node('plugin-arguments', 'arguments', 495, 134, { arguments: { arguments: ARGUMENTS } }),
        node('trajectory-context', 'context', 465, 250, { context: { source: 'trajectory_dumps' } }),
        node('foreach-trajectory-dumps', 'forEach', 455, 366, { forEach: { iterableSource: '{{ trajectory-context.trajectory_dumps }}' } }),
        node('analysis-entrypoint', 'entrypoint', 436, 482, {
            entrypoint: {
                type: 'executable',
                binary: 'coordination-analysis',
                binaryFileName: 'coordination-analysis',
                arguments: '{{ foreach-trajectory-dumps.currentValue.path }} {{ foreach-trajectory-dumps.outputPath }} {{ plugin-arguments.as_str }}',
                timeout: -1
            }
        }),
        node(COORDINATION_PRIMARY_EXPOSURE_ID, 'exposure', 0, 654, {
            exposure: { name: 'Coordination Analysis', icon: 'HiCube', results: 'coordination.parquet', iterable: '' }
        }),
        node(COORDINATION_MODEL_EXPOSURE_ID, 'exposure', 304, 654, {
            exposure: {
                name: 'Coordination Model',
                icon: 'HiCube',
                results: 'atoms.parquet',
                iterable: '',
                properties: [{ key: 'coordination', label: 'Coordination number', type: 'int' }]
            }
        }),
        node('coordination-model-export', 'export', 329, 770, { export: COORDINATION_MODEL_EXPORT }),
        node('rdf-chart-exposure', 'exposure', 571, 654, {
            exposure: { name: 'RDF Chart', icon: 'HiChartBar', results: 'rdf_chart.parquet', iterable: '', hasListing: false }
        }),
        node('rdf-chart-export', 'export', 609, 770, { export: RDF_CHART_EXPORT }),
        node('rdf-histogram-exposure', 'exposure', 856, 654, {
            exposure: {
                name: 'Partial RDF Histogram',
                icon: 'HiChartBar',
                results: 'rdf_histogram.parquet',
                iterable: '',
                hasListing: false,
                properties: [
                    { key: 'pair_type', label: 'Pair Type', type: 'string' },
                    { key: 'bin_center', label: 'Bin Center (Å)', type: 'double' },
                    { key: 'bin_count', label: 'Bin Count', type: 'int' }
                ]
            }
        })
    ],
    edges: [
        edge('edge-metadata-arguments', 'plugin-metadata', 'plugin-arguments'),
        edge('edge-arguments-context', 'plugin-arguments', 'trajectory-context'),
        edge('edge-context-foreach', 'trajectory-context', 'foreach-trajectory-dumps'),
        edge('edge-foreach-entrypoint', 'foreach-trajectory-dumps', 'analysis-entrypoint'),
        edge('edge-entrypoint-exposure', 'analysis-entrypoint', COORDINATION_PRIMARY_EXPOSURE_ID),
        edge('edge-entrypoint-coordination-model-exposure', 'analysis-entrypoint', COORDINATION_MODEL_EXPOSURE_ID),
        edge('edge-coordination-model-exposure-coordination-model-export', COORDINATION_MODEL_EXPOSURE_ID, 'coordination-model-export'),
        edge('edge-analysis-entrypoint-rdf-chart-exposure', 'analysis-entrypoint', 'rdf-chart-exposure'),
        edge('edge-rdf-chart-exposure-rdf-chart-export', 'rdf-chart-exposure', 'rdf-chart-export'),
        edge('edge-analysis-entrypoint-rdf-histogram-exposure', 'analysis-entrypoint', 'rdf-histogram-exposure')
    ]
};

// Its exposures as the server projects them from the workflow (WorkflowProjection).
const EXPOSURES = [
    { _id: COORDINATION_PRIMARY_EXPOSURE_ID, name: 'Coordination Analysis', icon: 'HiCube', results: 'coordination.parquet', hasListing: true, properties: [], export: null },
    {
        _id: COORDINATION_MODEL_EXPOSURE_ID,
        name: 'Coordination Model',
        icon: 'HiCube',
        results: 'atoms.parquet',
        hasListing: true,
        properties: [{ key: 'coordination', label: 'Coordination number', type: 'int' }],
        export: COORDINATION_MODEL_EXPORT
    },
    { _id: 'rdf-chart-exposure', name: 'RDF Chart', icon: 'HiChartBar', results: 'rdf_chart.parquet', hasListing: false, properties: [], export: RDF_CHART_EXPORT },
    {
        _id: 'rdf-histogram-exposure',
        name: 'Partial RDF Histogram',
        icon: 'HiChartBar',
        results: 'rdf_histogram.parquet',
        hasListing: false,
        properties: [
            { key: 'pair_type', label: 'Pair Type', type: 'string' },
            { key: 'bin_center', label: 'Bin Center (Å)', type: 'double' },
            { key: 'bin_count', label: 'Bin Count', type: 'int' }
        ],
        export: null
    }
];

const INSTALLED = hoursAgo(24 * 9);

export const COORDINATION_PLUGIN = {
    _id: COORDINATION_PLUGIN_ID,
    team: LANDING_TEAM_ID,
    teamCluster: LANDING_CLUSTER_ID,
    workflow: COORDINATION_WORKFLOW,
    status: 'published',
    modifier: MODIFIER,
    exposures: EXPOSURES,
    arguments: ARGUMENTS,
    listingExposures: {
        pluginName: MODIFIER.name,
        pluginId: COORDINATION_PLUGIN_ID,
        exposures: EXPOSURES.filter((exposure) => exposure.hasListing).map((exposure) => ({ exposureId: exposure._id, name: exposure.name }))
    },
    createdAt: INSTALLED,
    updatedAt: INSTALLED
};

const RAN = hoursAgo(1.1);
const FINISHED = hoursAgo(1);

export const COORDINATION_ANALYSIS = {
    _id: COORDINATION_ANALYSIS_ID,
    plugin: COORDINATION_PLUGIN_ID,
    pluginDisplayName: MODIFIER.name,
    config: COORDINATION_CONFIG,
    trajectory: { _id: SHEAR_DEFORMATION_ID, name: 'Shear Deformation' },
    pipelineRunId: COORDINATION_RUN_ID,
    pipelineStageIndex: 0,
    teamCluster: LANDING_CLUSTER_ID,
    createdBy: LANDING_USER._id,
    totalFrames: SAMPLE_TIMESTEPS.length,
    startedAt: RAN,
    finishedAt: FINISHED,
    status: 'completed',
    artifactStatus: 'ready',
    expectedArtifacts: [{
        exposureId: COORDINATION_MODEL_EXPOSURE_ID,
        name: 'Coordination Model',
        pluginId: COORDINATION_PLUGIN_ID,
        exporter: COORDINATION_MODEL_EXPORT.exporter,
        exportType: COORDINATION_MODEL_EXPORT.type,
        status: 'ready',
        isPrimary: true,
        produced: true,
        readyAt: FINISHED
    }],
    createdAt: RAN,
    updatedAt: FINISHED
};

export const COORDINATION_RUN = {
    _id: COORDINATION_RUN_ID,
    name: null,
    trajectory: SHEAR_DEFORMATION_ID,
    team: LANDING_TEAM_ID,
    createdBy: LANDING_USER._id,
    computeClusterId: LANDING_CLUSTER_ID,
    storageClusterId: LANDING_CLUSTER_ID,
    selectedTimesteps: SAMPLE_TIMESTEPS,
    stages: [{
        index: 0,
        kind: 'plugin',
        pluginId: COORDINATION_PLUGIN_ID,
        pluginDisplayName: MODIFIER.name,
        config: COORDINATION_CONFIG,
        analysisId: COORDINATION_ANALYSIS_ID,
        cacheHit: false
    }],
    createdAt: RAN,
    updatedAt: FINISHED
};

// What the canvas can draw of the analysis: the model its exporter wrote for each frame.
export const COORDINATION_RENDERABLE_EXPOSURES = [{
    pluginId: COORDINATION_PLUGIN_ID,
    analysisId: COORDINATION_ANALYSIS_ID,
    exposureId: COORDINATION_MODEL_EXPOSURE_ID,
    name: 'Coordination Model',
    icon: 'HiCube',
    results: 'atoms.parquet',
    canvas: true,
    export: COORDINATION_MODEL_EXPORT
}];

// How many atoms of each of the sample's dumps have each coordination, at the analysis's cutoff,
// and the plugin's main listing for each frame (coordination_service.cpp) that follows from it,
// with its fields in the order its JSON writes them.
export const COORDINATION_FRAMES = [
    { timestep: 75_000, counts: { 10: 327, 11: 807, 12: 35_483, 13: 7 } },
    { timestep: 1_500_000, counts: { 10: 338, 11: 785, 12: 35_498, 13: 3 } },
    { timestep: 2_625_000, counts: { 10: 333, 11: 831, 12: 35_453, 13: 7 } }
];

const LISTING_FIELDS = ['cutoff', 'max_coordination', 'mean_coordination', 'min_coordination', 'rdf_bins', 'total_atoms'];

export const COORDINATION_LISTING = {
    data: COORDINATION_FRAMES.map((frame) => {
        const tally = Object.entries(frame.counts).map(([coordination, atoms]) => [Number(coordination), atoms]);
        const coordinations = tally.map(([coordination]) => coordination);
        return {
            _id: `${COORDINATION_ANALYSIS_ID}-${frame.timestep}`,
            timestep: frame.timestep,
            analysisId: COORDINATION_ANALYSIS_ID,
            trajectoryId: SHEAR_DEFORMATION_ID,
            exposureId: COORDINATION_PRIMARY_EXPOSURE_ID,
            trajectoryName: 'Shear Deformation',
            cutoff: COORDINATION_CONFIG.cutoff,
            max_coordination: Math.max(...coordinations),
            mean_coordination: tally.reduce((sum, [coordination, atoms]) => sum + coordination * atoms, 0) / SAMPLE_ATOMS,
            min_coordination: Math.min(...coordinations),
            rdf_bins: COORDINATION_CONFIG.rdf_bins,
            total_atoms: SAMPLE_ATOMS
        };
    }),
    total: COORDINATION_FRAMES.length,
    page: 1,
    limit: 20,
    totalPages: 1,
    _meta: {
        pluginId: COORDINATION_PLUGIN_ID,
        exposureName: 'Coordination Analysis',
        exposureId: COORDINATION_PRIMARY_EXPOSURE_ID,
        columns: [
            { key: 'trajectoryName', label: 'Trajectory', sortable: true },
            { key: 'timestep', label: 'Timestep', sortable: true },
            ...LISTING_FIELDS.map((key) => ({ key, label: key, sortable: true }))
        ],
        subListingNames: ['rdf']
    }
};
