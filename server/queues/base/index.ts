// Re-export main queue class for backward compatibility
export { BaseProcessingQueue } from './queue-core';

// Export individual components for advanced usage
export { WorkerPool, WorkerPoolConfig } from './worker-pool';
export { SessionManager, SessionManagerConfig } from './session-manager';
export { RecoveryManager, RecoveryManagerConfig } from './recovery-manager';
export { JobHandler, JobHandlerConfig, JobInfo } from './job-handler';
