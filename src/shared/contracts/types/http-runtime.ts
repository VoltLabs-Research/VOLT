export const EntrypointType = Object.freeze({
    Executable: 'executable',
    PythonScript: 'python-script',
    PackagedExecutable: 'packaged-executable'
} as const);
export type EntrypointType = typeof EntrypointType[keyof typeof EntrypointType];

export const OrchestrationAction = Object.freeze({
    AnalysisStart: 'analysis-start',
    PipelineStart: 'pipeline-start',
    ContainerCreate: 'container-create',
    PluginSync: 'plugin-sync'
} as const);
export type OrchestrationAction = typeof OrchestrationAction[keyof typeof OrchestrationAction];
