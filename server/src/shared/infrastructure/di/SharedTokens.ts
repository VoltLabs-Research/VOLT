export const SHARED_TOKENS = Object.freeze({
    StorageService: Symbol.for('StorageService'),
    TempFileService: Symbol.for('TempFileService'),
    TempStorageLifecycleService: Symbol.for('TempStorageLifecycleService'),
    EventBus: Symbol.for('EventBus'),
    RedisClient: Symbol.for('RedisClient'),
    FileExtractorService: Symbol.for('FileExtractorService'),
    DaemonCredentialGuard: Symbol.for('DaemonCredentialGuard'),
    TeamClusterDaemonClient: Symbol.for('TeamClusterDaemonClient'),
    TeamClusterObjectGatewayClient: Symbol.for('TeamClusterObjectGatewayClient'),
    TeamClusterServiceResolver: Symbol.for('TeamClusterServiceResolver'),
    TeamClusterStorageResolver: Symbol.for('TeamClusterStorageResolver'),
    TeamClusterRedisFactory: Symbol.for('TeamClusterRedisFactory')
});
