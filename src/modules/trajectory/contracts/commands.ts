export const TrajectoryQueueCommands = Object.freeze({
    Rasterize: 'trajectory.rasterize',
    EnqueuePreprocessing: 'trajectory.enqueue-preprocessing'
});

export const TrajectoryNativeCommands = Object.freeze({
    Preprocess: 'trajectory.native.preprocess',
    Metadata: 'trajectory.native.metadata',
    PropertyStats: 'trajectory.native.property-stats',
    UniqueValues: 'trajectory.native.unique-values',
    AtomIds: 'trajectory.native.atom-ids',
    Atoms: 'trajectory.native.atoms',
    FilterPreview: 'trajectory.native.filter-preview',
    ColorModel: 'trajectory.native.color-model',
    ParticleFilterModel: 'trajectory.native.particle-filter-model'
});

export const TrajectoryPluginCommands = Object.freeze({
    PropertyNames: 'trajectory.plugin.property-names',
    ModifierAnalysis: 'trajectory.plugin.modifier-analysis',
    AtomIndex: 'trajectory.plugin.atom-index',
    ModifierValues: 'trajectory.plugin.modifier-values',
    ModifierStats: 'trajectory.plugin.modifier-stats',
    ModifierUniqueValues: 'trajectory.plugin.modifier-unique-values',
    AnalysisAllAtoms: 'trajectory.plugin.analysis-all-atoms'
});
