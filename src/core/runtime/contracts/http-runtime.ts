export enum EntrypointType {
    Executable = 'executable',
    PythonScript = 'python-script',
    PackagedExecutable = 'packaged-executable'
};

export enum OrchestrationAction {
    AnalysisStart = 'analysis-start',
    ContainerCreate = 'container-create',
    TrajectoryPreprocess = 'trajectory-preprocess',
    NativeTrajectoryPreprocess = 'native-trajectory-preprocess',
    QueueDispatch = 'queue-dispatch',
    PluginSync = 'plugin-sync',
    ObjectUpload = 'object-upload',
    NativeColorModelExport = 'native-color-model-export',
    NativeParticleFilterExport = 'native-particle-filter-export',
    Uninstall = 'uninstall'
};
