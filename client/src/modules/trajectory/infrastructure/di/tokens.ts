export const TRAJECTORY_TOKENS = {
    TrajectoryRepository: Symbol('TrajectoryRepository'),
    ParticleFilterRepository: Symbol('ParticleFilterRepository'),
    ColorCodingRepository: Symbol('ColorCodingRepository'),
    SceneArtifactRepository: Symbol('SceneArtifactRepository'),
    PreviewCache: Symbol('PreviewCache'),
    ListSceneArtifactsUseCase: Symbol('ListSceneArtifactsUseCase'),
    DeleteTrajectoryUseCase: Symbol('DeleteTrajectoryUseCase')
} as const;
