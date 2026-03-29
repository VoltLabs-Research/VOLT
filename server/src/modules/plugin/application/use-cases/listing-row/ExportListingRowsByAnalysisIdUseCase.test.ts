import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import Analysis from '@modules/analysis/domain/entities/Analysis';
import Plugin, { PluginStatus } from '@modules/plugin/domain/entities/plugin/Plugin';
import Workflow from '@modules/plugin/domain/entities/plugin/workflow/Workflow';
import { ExportType as WorkflowExportType, Exporter } from '@modules/plugin/domain/entities/plugin/workflow/nodes/ExportNode';
import Trajectory, { TrajectoryStatus } from '@modules/trajectory/domain/entities/trajectory/Trajectory';
import { AnalysisListingExportCatalogService, buildAnalysisListingSelectionId } from '@modules/plugin/application/services/listing-row/AnalysisListingExportCatalogService';
import { ExportType } from '@shared/domain/port/IBaseRepository';
import { Readable } from 'node:stream';
import { ExportListingRowsByAnalysisIdUseCase } from './ExportListingRowsByAnalysisIdUseCase';

class StubListingRowsExportPresenter {
    public payload: any;

    present(payload: any) {
        this.payload = payload;

        return {
            stream: Readable.from([]),
            headers: {}
        };
    }
}

class StubAnalysisRepository {
    constructor(private readonly analysis: Analysis) {}

    async findById(): Promise<Analysis> {
        return this.analysis;
    }
}

class StubTrajectoryRepository {
    constructor(private readonly trajectory: Trajectory) {}

    async findById(): Promise<Trajectory> {
        return this.trajectory;
    }
}

class StubPluginRepository {
    constructor(private readonly plugin: Plugin) {}

    async findById(): Promise<Plugin> {
        return this.plugin;
    }
}

class StubDaemonClient {
    public readonly calls: Array<{ command: string; payload: Record<string, unknown> }> = [];

    async command<T>(_: string, command: string, payload: Record<string, unknown>): Promise<T> {
        this.calls.push({ command, payload });

        if (command === 'plugin.listings.list') {
            return {
                data: [
                    {
                        _id: 'row-mesh',
                        plugin: 'plugin-1',
                        trajectory: 'trajectory-1',
                        exposureId: 'mesh-exposure',
                        exposureName: 'Defect Mesh',
                        timestep: 1000,
                        row: { triangles: 42 }
                    },
                    {
                        _id: 'row-dislocations',
                        plugin: 'plugin-1',
                        trajectory: 'trajectory-1',
                        exposureId: 'dislocations-exposure',
                        exposureName: 'Dislocations',
                        timestep: 1000,
                        subListingNames: ['dislocation_segments'],
                        row: { length: 12.5 }
                    }
                ],
                total: 2,
                page: 1,
                totalPages: 1,
                limit: 200
            } as T;
        }

        if (command === 'plugin.sub-listings.list') {
            return {
                data: [
                    {
                        _id: 'sub-row-1',
                        row: { segmentId: 1, burgers: '[1 0 0]' }
                    }
                ],
                total: 1,
                page: 1,
                totalPages: 1,
                limit: 200
            } as T;
        }

        throw new Error(`Unexpected daemon command: ${command}`);
    }
}

const buildPlugin = () => new Plugin('plugin-1', {
    team: 'team-1',
    workflow: new Workflow('workflow-1', {
        nodes: [],
        edges: []
    }),
    status: PluginStatus.Published,
    createdAt: new Date(),
    updatedAt: new Date(),
    exposures: [
        {
            _id: 'mesh-exposure',
            name: 'Defect Mesh',
            results: 'mesh',
            canvas: true,
            raster: false,
            hasListing: true,
            export: {
                exporter: Exporter.Mesh,
                type: WorkflowExportType.GLB
            }
        },
        {
            _id: 'dislocations-exposure',
            name: 'Dislocations',
            results: 'dislocations',
            canvas: true,
            raster: false,
            hasListing: true,
            export: {
                exporter: Exporter.Dislocation,
                type: WorkflowExportType.GLB
            }
        }
    ]
});

const buildAnalysis = () => new Analysis('analysis-1', {
    plugin: 'plugin-1',
    pluginDisplayName: 'Dislocation Analysis',
    computeClusterId: 'compute-1',
    config: {
        cutoff: 3.2
    },
    trajectory: 'trajectory-1',
    createdBy: 'user-1',
    team: 'team-1',
    status: 'completed',
    createdAt: new Date(),
    updatedAt: new Date()
});

const buildTrajectory = () => new Trajectory('trajectory-1', {
    name: 'Trajectory 1',
    team: 'team-1',
    folder: null,
    createdBy: 'user-1',
    status: TrajectoryStatus.Completed,
    isPublic: false,
    frames: [],
    rasterSceneViews: 0,
    stats: {
        totalFiles: 1,
        totalSize: 1
    },
    updatedAt: new Date(),
    createdAt: new Date()
});

test('ExportListingRowsByAnalysisIdUseCase excludes MeshExporter data from listings and sub-listings', async () => {
    const presenter = new StubListingRowsExportPresenter();
    const daemonClient = new StubDaemonClient();
    const catalogService = new AnalysisListingExportCatalogService(
        new StubAnalysisRepository(buildAnalysis()) as any,
        new StubTrajectoryRepository(buildTrajectory()) as any,
        new StubPluginRepository(buildPlugin()) as any,
        daemonClient as any
    );
    const useCase = new ExportListingRowsByAnalysisIdUseCase(
        presenter as any,
        catalogService as any
    );

    const result = await useCase.execute({
        analysisId: 'analysis-1',
        teamId: 'team-1',
        format: ExportType.Csv
    });

    assert.equal(result.success, true);
    assert.ok(presenter.payload);
    assert.deepEqual(
        presenter.payload.listings.map((listing: { listingId: string }) => listing.listingId),
        ['dislocations-exposure']
    );
    assert.deepEqual(
        presenter.payload.subListings.map((subListing: { exposureId: string; subListingName: string }) => ({
            exposureId: subListing.exposureId,
            subListingName: subListing.subListingName
        })),
        [{
            exposureId: 'dislocations-exposure',
            subListingName: 'dislocation_segments'
        }]
    );
    assert.deepEqual(
        daemonClient.calls.filter((call) => call.command === 'plugin.sub-listings.list').map((call) => call.payload.exposureId),
        ['dislocations-exposure']
    );
});

test('ExportListingRowsByAnalysisIdUseCase only exports explicitly selected items', async () => {
    const presenter = new StubListingRowsExportPresenter();
    const daemonClient = new StubDaemonClient();
    const catalogService = new AnalysisListingExportCatalogService(
        new StubAnalysisRepository(buildAnalysis()) as any,
        new StubTrajectoryRepository(buildTrajectory()) as any,
        new StubPluginRepository(buildPlugin()) as any,
        daemonClient as any
    );
    const useCase = new ExportListingRowsByAnalysisIdUseCase(
        presenter as any,
        catalogService as any
    );

    const result = await useCase.execute({
        analysisId: 'analysis-1',
        teamId: 'team-1',
        format: ExportType.Csv,
        includeConfig: false,
        selectedListingIds: [buildAnalysisListingSelectionId('dislocations-exposure', 'Dislocations')],
        selectedSubListingIds: []
    });

    assert.equal(result.success, true);
    assert.ok(presenter.payload);
    assert.equal(presenter.payload.config, undefined);
    assert.deepEqual(
        presenter.payload.listings.map((listing: { listingId: string }) => listing.listingId),
        ['dislocations-exposure']
    );
    assert.deepEqual(presenter.payload.subListings, []);
    assert.deepEqual(
        daemonClient.calls.filter((call) => call.command === 'plugin.sub-listings.list'),
        []
    );
});

test('ExportListingRowsByAnalysisIdUseCase treats empty-selection sentinel as no listing exports', async () => {
    const presenter = new StubListingRowsExportPresenter();
    const daemonClient = new StubDaemonClient();
    const catalogService = new AnalysisListingExportCatalogService(
        new StubAnalysisRepository(buildAnalysis()) as any,
        new StubTrajectoryRepository(buildTrajectory()) as any,
        new StubPluginRepository(buildPlugin()) as any,
        daemonClient as any
    );
    const useCase = new ExportListingRowsByAnalysisIdUseCase(
        presenter as any,
        catalogService as any
    );

    const result = await useCase.execute({
        analysisId: 'analysis-1',
        teamId: 'team-1',
        format: ExportType.Csv,
        includeConfig: true,
        selectedListingIds: ['__volt_empty_selection__'],
        selectedSubListingIds: ['__volt_empty_selection__']
    });

    assert.equal(result.success, true);
    assert.ok(presenter.payload);
    assert.deepEqual(presenter.payload.listings, []);
    assert.deepEqual(presenter.payload.subListings, []);
    assert.deepEqual(
        daemonClient.calls.filter((call) => call.command === 'plugin.sub-listings.list'),
        []
    );
});
