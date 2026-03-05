export const PLUGIN_TOKENS = {
    PluginRepository: Symbol.for('PluginRepository'),
    PluginListingService: Symbol.for('PluginListingService'),
    WorkflowValidatorService: Symbol.for('WorkflowValidatorService'),
    ListingRowPrecomputationService: Symbol.for('ListingRowPrecomputationService'),
    ListingRowRepository: Symbol.for('ListingRowRepository'),
    NodeRegistry: Symbol.for('NodeRegistry'),
    PluginStorageService: Symbol.for('PluginStorageService'),
    PluginBinaryCacheService: Symbol.for('PluginBinaryCacheService'),
    PluginWorkflowEngine: Symbol.for('WorkflowEngine'),
    ProcessExecutorService: Symbol.for('ProcessExecutorService'),

    AnalysisProcessingQueue: Symbol.for('AnalysisProcessingQueue'),
    AnalysisJobFactory: Symbol.for('AnalysisJobFactory'),

    ModifierHandler: Symbol.for('ModifierHandler'),
    ArgumentsHandler: Symbol.for('ArgumentsHandler'),
    ContextHandler: Symbol.for('ContextHandler'),
    ForEachHandler: Symbol.for('ForEachHandler'),
    EntrypointHandler: Symbol.for('EntrypointHandler'),
    ExposureHandler: Symbol.for('ExposureHandler'),
    ExportHandler: Symbol.for('ExportHandler'),
    IfStatementHandler: Symbol.for('IfStatementHandler')
};