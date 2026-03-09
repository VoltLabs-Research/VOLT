export const SHARED_TOKENS = Object.freeze({
    StorageService: Symbol.for('StorageService'),
    TempFileService: Symbol.for('TempFileService'),
    EventBus: Symbol.for('EventBus'),
    RedisClient: Symbol.for('RedisClient'),
    FileExtractorService: Symbol.for('FileExtractorService'),
    TeamClusterDaemonClient: Symbol.for('TeamClusterDaemonClient'),
    TeamClusterServiceResolver: Symbol.for('TeamClusterServiceResolver'),
    TeamClusterStorageResolver: Symbol.for('TeamClusterStorageResolver'),
    TeamClusterRedisFactory: Symbol.for('TeamClusterRedisFactory')
});
