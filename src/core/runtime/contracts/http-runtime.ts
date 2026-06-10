export const EntrypointType = Object.freeze({
    Executable: 'executable',
    PythonScript: 'python-script',
    PackagedExecutable: 'packaged-executable'
} as const);
export type EntrypointType = typeof EntrypointType[keyof typeof EntrypointType];

export const OrchestrationAction = Object.freeze({
    AnalysisStart: 'analysis-start',
    ContainerCreate: 'container-create',
    TrajectoryPreprocess: 'trajectory-preprocess',
    NativeTrajectoryPreprocess: 'native-trajectory-preprocess',
    QueueDispatch: 'queue-dispatch',
    PluginSync: 'plugin-sync',
    ObjectUpload: 'object-upload',
    NativeColorModelExport: 'native-color-model-export',
    NativeParticleFilterExport: 'native-particle-filter-export',
    Uninstall: 'uninstall'
} as const);
export type OrchestrationAction = typeof OrchestrationAction[keyof typeof OrchestrationAction];
