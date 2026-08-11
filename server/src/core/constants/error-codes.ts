export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * `const T` is load-bearing: without it TypeScript widens each property to
 * `string`, which silently turned `ErrorCode` into `string` and made both the
 * `isErrorCode` guard and every `code: ErrorCode` parameter accept anything.
 */
const createErrorCodes = <const T extends Record<string, string>>(errorCodes: T): Readonly<T> => Object.freeze(errorCodes);

export const ErrorCodes = createErrorCodes({
    INTERNAL_SERVER_ERROR: 'Internal::Server::Error',

    AUTH_UNAUTHORIZED: 'Auth::Unauthorized',
    AUTH_CREDENTIALS_INVALID: 'Auth::Credentials::Invalid',
    AUTH_EMAIL_REQUIRED: 'Auth::Email::Required',
    AUTH_NAME_REQUIRED: 'Auth::Name::Required',
    AUTH_PASSWORD_TOO_SHORT: 'Auth::Password::TooShort',
    AUTH_PASSWORD_REQUIRED: 'Auth::Password::Required',

    AUTHENTICATION_REQUIRED: 'Authentication::Required',
    AUTHENTICATION_UNAUTHORIZED: 'Authentication::Unauthorized',
    AUTHENTICATION_GUEST_SEED_REQUIRED: 'Authentication::Guest::SeedRequired',
    AUTHENTICATION_UPDATE_PASSWORD_INCORRECT: 'Authentication::Update::PasswordCurrentIncorrect',

    USER_NOT_FOUND: 'User::NotFound',

    VALIDATION_INVALID_INPUT: 'Validation::InvalidInput',

    TEAM_NOT_FOUND: 'Team::NotFound',
    TEAM_ID_REQUIRED: 'Team::IdRequired',
    TEAM_ACCESS_DENIED: 'Team::AccessDenied',
    TEAM_CLUSTER_ALREADY_EXISTS: 'TeamCluster::AlreadyExists',
    TEAM_CLUSTER_REMOTE_EXPLORER_LIST_FAILED: 'TeamCluster::RemoteExplorerListFailed',
    TEAM_CLUSTER_REMOTE_EXPLORER_NODE_FAILED: 'TeamCluster::RemoteExplorerNodeFailed',
    TEAM_CLUSTER_REMOTE_EXPLORER_DOWNLOAD_FAILED: 'TeamCluster::RemoteExplorerDownloadFailed',
    TEAM_CLUSTER_NOT_FOUND: 'TeamCluster::NotFound',
    TEAM_CLUSTER_DAEMON_STREAM_REQUEST_FAILED: 'TeamCluster::DaemonStreamRequestFailed',
    TEAM_CLUSTER_DAEMON_UNAUTHORIZED: 'TeamCluster::DaemonUnauthorized',
    TEAM_CLUSTER_DELETION_ALREADY_IN_PROGRESS: 'TeamCluster::DeletionAlreadyInProgress',
    TEAM_CLUSTER_INVALID_INSTALL_ROOT: 'TeamCluster::InvalidInstallRoot',
    TEAM_CLUSTER_INVALID_STATUS_FOR_TOKEN_REGENERATION: 'TeamCluster::InvalidStatusForTokenRegeneration',
    TEAM_CLUSTER_LIFECYCLE_STATUS_INVALID: 'TeamCluster::LifecycleStatusInvalid',
    TEAM_CLUSTER_MISSING: 'TeamCluster::Missing',
    TEAM_CLUSTER_NAME_REQUIRED: 'TeamCluster::NameRequired',
    /*
     * The stored service credentials cannot be decrypted with the encryption key
     * this process has. Recoverable state, not a server defect: the cluster row
     * outlived the key it was encrypted with.
     */
    TEAM_CLUSTER_CREDENTIALS_UNREADABLE: 'TeamCluster::CredentialsUnreadable',
    TEAM_CLUSTER_REMOTE_UNINSTALL_REJECTED: 'TeamCluster::RemoteUninstallRejected',
    TEAM_CLUSTER_REMOTE_UNINSTALL_REQUEST_FAILED: 'TeamCluster::RemoteUninstallRequestFailed',
    TEAM_CLUSTER_SOCKET_LIFECYCLE_ONLY: 'TeamCluster::SocketLifecycleOnly',

    CLUSTER_TRANSFER_DESTINATION_CLUSTER_UNAVAILABLE: 'ClusterTransfer::DestinationClusterUnavailable',
    CLUSTER_TRANSFER_DESTINATION_MUST_DIFFER: 'ClusterTransfer::DestinationMustDiffer',
    CLUSTER_TRANSFER_NO_PLACEMENTS: 'ClusterTransfer::NoPlacements',
    CLUSTER_TRANSFER_SOURCE_CLUSTER_UNAVAILABLE: 'ClusterTransfer::SourceClusterUnavailable',
    CLUSTER_TRANSFER_JOB_NOT_FOUND: 'ClusterTransferJob::NotFound',
    STORAGE_PLACEMENT_NOT_FOUND: 'StoragePlacement::NotFound',

    RBAC_INSUFFICIENT_PERMISSIONS: 'RBAC::InsufficientPermissions',
    TEAM_MEMBERSHIP_FORBIDDEN: 'Team::Membership::Forbidden',
    TEAM_USER_NOT_MEMBER: 'Team::UserNotAMember',

    CONTAINER_NOT_FOUND: 'Container::NotFound',
    CONTAINER_NOT_RUNNING: 'Container::NotRunning',
    CONTAINER_FILE_IS_DIRECTORY: 'Container::File::IsDirectory',
    CONTAINER_NETWORKING_UNAVAILABLE: 'Container::NetworkingUnavailable',
    CONTAINER_PORT_UNAVAILABLE: 'Container::PortUnavailable',
    CONTAINER_PUBLIC_PORT_UNAVAILABLE: 'Container::PublicPortUnavailable',

    SESSION_NOT_FOUND: 'Session::NotFound',
    SESSION_REVOKE_FAILED: 'Session::RevokeSession::Failed',

    SIMULATION_CELL_NOT_FOUND: 'SimulationCell::NotFound',

    TRAJECTORY_CREATION_NO_VALID_FILES: 'Trajectory::Creation::NoValidFiles',

    ANALYSIS_NOT_FOUND: 'Analysis::NotFound',

    PLUGIN_NOT_FOUND: 'Plugin::NotFound',
    PLUGIN_NODE_NOT_FOUND: 'Plugin::Node::NotFound',
    PLUGIN_EXECUTOR_BINARY_NOT_ACCESSIBLE: 'Plugin::Executor::Binary::NotAccessible',

    FILE_NOT_FOUND: 'File::NotFound',
    FILE_READ_ERROR: 'File::ReadError',

    RASTER_NOT_FOUND: 'Raster::NotFound',
    RASTER_FAILED: 'Raster::Failed',
    RASTER_ALREADY_QUEUED: 'Raster::AlreadyQueued',

    COLOR_CODING_MISSING_PARAMS: 'ColorCoding::MissingParams',
    COLOR_CODING_DUMP_NOT_FOUND: 'ColorCoding::DumpNotFound',

    PARTICLE_FILTER_PLUGIN_PROPERTY_UNAVAILABLE: 'ParticleFilter::PluginPropertyUnavailable',


    RESOURCE_NOT_FOUND: 'Resource::NotFound',
    RESOURCE_LOAD_ERROR: 'Resource::LoadError',
    VALIDATION_MISSING_REQUIRED_FIELDS: 'Validation::MissingRequiredFields',
    VALIDATION_DUPLICATE_RESOURCE: 'Validation::DuplicateResource',

    TEAM_INVITATION_NOT_FOUND: 'TeamInvitation::NotFound',
    TEAM_INVITATION_ALREADY_PROCESSED: 'TeamInvitation::AlreadyProcessed',
    TEAM_INVITATION_EXPIRED: 'TeamInvitation::Expired',
    TEAM_INVITATION_ALREADY_SENT: 'TeamInvitation::AlreadySent',
    TEAM_INVITATION_USER_ALREADY_MEMBER: 'TeamInvitation::UserAlreadyMember',
    TEAM_INVITATION_INVALID_USER: 'TeamInvitation::InvalidUser',

    PLUGIN_NOT_VALID_CANNOT_PUBLISH: 'Plugin::NotValid::CannotPublish',
    PLUGIN_NOT_VALID_CANNOT_EXECUTE: 'Plugin::NotValid::CannotExecute',

    TRAJECTORY_NOT_FOUND: 'Trajectory::NotFound',
    TRAJECTORY_ANALYSIS_MISMATCH: 'Trajectory::Analysis::Mismatch',
    TRAJECTORY_DUMP_NOT_FOUND: 'Trajectory::Dump::NotFound',
    TRAJECTORY_DATA_PARSE_FAILED: 'Trajectory::Data::ParseFailed',
    TRAJECTORY_CLONE_JOB_NOT_FOUND: 'TrajectoryCloneJob::NotFound',
    TRAJECTORY_UPLOAD_SESSION_EXPIRED: 'TrajectoryUploadSession::Expired',
    TRAJECTORY_UPLOAD_SESSION_NOT_FOUND: 'TrajectoryUploadSession::NotFound',
    TRAJECTORY_UPLOAD_SESSION_NOT_PENDING: 'TrajectoryUploadSession::NotPending',

    ANALYSIS_PROVENANCE_NOT_FOUND: 'AnalysisProvenance::NotFound',
    REGISTRY_PACKAGE_NAME_REQUIRED: 'Registry::PackageNameRequired',
    REGISTRY_PACKAGE_NOT_FOUND: 'Registry::PackageNotFound',

    TEAM_ROLE_NOT_FOUND: 'TeamRole::NotFound',
    TEAM_ROLE_IS_SYSTEM: 'TeamRole::IsSystem',

    TEAM_MEMBER_NOT_FOUND: 'TeamMember::NotFound',

    TEAM_AI_INTEGRATION_NOT_FOUND: 'TeamAIIntegration::NotFound',
    TEAM_AI_INTEGRATION_ALREADY_EXISTS: 'TeamAIIntegration::AlreadyExists',
    TEAM_AI_INTEGRATION_PROVIDER_UNSUPPORTED: 'TeamAIIntegration::Provider::Unsupported',
    TEAM_AI_INTEGRATION_API_KEY_REQUIRED: 'TeamAIIntegration::ApiKey::Required',
    TEAM_AI_INTEGRATION_MODEL_UNSUPPORTED: 'TeamAIIntegration::Model::Unsupported',

    SECRET_KEY_INVALID: 'SecretKey::Invalid',
    SECRET_KEY_NOT_FOUND: 'SecretKey::NotFound',

    AI_CONVERSATION_NOT_FOUND: 'AI::Conversation::NotFound',
    AI_INTEGRATION_NOT_CONFIGURED: 'AI::Integration::NotConfigured',
    AI_PROVIDER_UNAVAILABLE: 'AI::Provider::Unavailable',
    OAUTH_STRATEGY_ERROR: 'OAuth::Strategy::Error',

    SCRIPTING_SESSION_FAILED: 'Scripting::Session::Failed',
    SCRIPTING_DAEMON_UNAVAILABLE: 'Scripting::Daemon::Unavailable',
    SCRIPTING_NOTEBOOK_NOT_FOUND: 'Scripting::Notebook::NotFound',
    SCRIPTING_PENDING_NOTEBOOK_NOT_FOUND: 'Scripting::PendingNotebookNotFound',

    TEAM_INVITE_CODE_NOT_FOUND: 'TeamInviteCode::NotFound',
    TEAM_INVITE_CODE_ALREADY_MEMBER: 'TeamInviteCode::AlreadyMember',

    CLUSTER_OBJECT_GATEWAY_FAILED: 'ClusterObject::GatewayFailed',
    REGISTRY_UNAVAILABLE: 'Registry::Unavailable',
    SCRIPTING_JUPYTER_UNAVAILABLE: 'Scripting::JupyterUnavailable',
    TEAM_CLUSTER_COMPUTE_CAPABILITY_REQUIRED: 'TeamCluster::ComputeCapabilityRequired',
    TEAM_CLUSTER_COMPUTE_CLUSTER_REQUIRED: 'TeamCluster::ComputeClusterRequired',
    TEAM_CLUSTER_CONNECTED_CLUSTER_REQUIRED: 'TeamCluster::ConnectedClusterRequired',
    TEAM_CLUSTER_DAEMON_ANALYSIS_CLUSTER_MISMATCH: 'TeamCluster::Daemon::Analysis::ClusterMismatch',
    TEAM_CLUSTER_DAEMON_ANALYSIS_NOT_FOUND: 'TeamCluster::Daemon::Analysis::NotFound',
    TEAM_CLUSTER_DAEMON_ANALYSIS_PLUGIN_MISMATCH: 'TeamCluster::Daemon::Analysis::PluginMismatch',
    TEAM_CLUSTER_DAEMON_ANALYSIS_STORAGE_CLUSTER_REQUIRED: 'TeamCluster::Daemon::Analysis::StorageClusterRequired',
    TEAM_CLUSTER_DAEMON_ANALYSIS_TEAM_MISMATCH: 'TeamCluster::Daemon::Analysis::TeamMismatch',
    TEAM_CLUSTER_DAEMON_ANALYSIS_TRAJECTORY_MISMATCH: 'TeamCluster::Daemon::Analysis::TrajectoryMismatch',
    TEAM_CLUSTER_DAEMON_ANALYSIS_TRAJECTORY_TEAM_MISMATCH: 'TeamCluster::Daemon::Analysis::TrajectoryTeamMismatch',
    TEAM_CLUSTER_DAEMON_SCENE_ARTIFACT_BATCH_AUTH_MISMATCH: 'TeamCluster::Daemon::SceneArtifact::BatchAuthMismatch',
    TEAM_CLUSTER_DAEMON_TRAJECTORY_CLUSTER_MISMATCH: 'TeamCluster::Daemon::Trajectory::ClusterMismatch',
    TEAM_CLUSTER_DAEMON_TRAJECTORY_NOT_FOUND: 'TeamCluster::Daemon::Trajectory::NotFound',
    TEAM_CLUSTER_DAEMON_TRAJECTORY_STORAGE_CLUSTER_REQUIRED: 'TeamCluster::Daemon::Trajectory::StorageClusterRequired',
    TEAM_CLUSTER_DAEMON_TRAJECTORY_TEAM_MISMATCH: 'TeamCluster::Daemon::Trajectory::TeamMismatch',
    TEAM_CLUSTER_DAEMON_REQUEST_FAILED: 'TeamCluster::DaemonRequestFailed',
    TEAM_CLUSTER_OBJECT_STORE_PROXY_METHOD_NOT_ALLOWED: 'TeamCluster::ObjectStoreProxyMethodNotAllowed',
    TEAM_CLUSTER_STORAGE_CAPABILITY_REQUIRED: 'TeamCluster::StorageCapabilityRequired',

    // Codes that used to be written as bare string literals at the throw site.
    // Registering them here is what lets ApplicationError require an ErrorCode.
    ANALYSIS_STORAGE_CLUSTER_REQUIRED: 'Analysis::StorageClusterRequired',
    CLUSTER_OBJECT_CONTENT_LENGTH_MISMATCH: 'ClusterObject::ContentLengthMismatch',
    CLUSTER_OBJECT_CONTENT_LENGTH_REQUIRED: 'ClusterObject::ContentLengthRequired',
    CLUSTER_OBJECT_INVALID_SIGNED_URL: 'ClusterObject::InvalidSignedUrl',
    CLUSTER_TRANSFER_DESTINATION_CLUSTER_HARD_LIMIT_REACHED: 'ClusterTransfer::DestinationClusterHardLimitReached',
    CLUSTER_TRANSFER_DESTINATION_CLUSTER_WRITE_CAPABILITY_REQUIRED: 'ClusterTransfer::DestinationClusterWriteCapabilityRequired',
    CLUSTER_TRANSFER_SOURCE_CLUSTER_READ_CAPABILITY_REQUIRED: 'ClusterTransfer::SourceClusterReadCapabilityRequired',
    CLUSTER_TRANSFER_VERIFICATION_HASH_MISMATCH: 'ClusterTransfer::VerificationHashMismatch',
    CLUSTER_TRANSFER_VERIFICATION_MISMATCH: 'ClusterTransfer::VerificationMismatch',
    CLUSTER_TRANSFER_VERIFICATION_MISSING_DESTINATION_OBJECT: 'ClusterTransfer::VerificationMissingDestinationObject',
    CLUSTER_TRANSFER_VERIFICATION_SIZE_MISMATCH: 'ClusterTransfer::VerificationSizeMismatch',
    PLUGIN_EXPOSURE_CHART_UNSUPPORTED_ARTIFACT: 'PluginExposureChart::UnsupportedArtifact',
    REGISTRY_INVALID_PACKAGE_NAME: 'Registry::InvalidPackageName',
    STORAGE_PLACEMENT_ANALYSIS_STORAGE_CLUSTER_REQUIRED: 'StoragePlacement::AnalysisStorageClusterRequired',
    STORAGE_PLACEMENT_TRAJECTORY_STORAGE_CLUSTER_REQUIRED: 'StoragePlacement::TrajectoryStorageClusterRequired',
    TEAM_CLUSTER_DAEMON_UNAVAILABLE: 'TeamCluster::DaemonUnavailable',
    TEAM_CLUSTER_ENROLLMENT_ALREADY_COMPLETED: 'TeamCluster::EnrollmentAlreadyCompleted',
    TEAM_CLUSTER_ENROLLMENT_INVALID: 'TeamCluster::EnrollmentInvalid',
    TEAM_CLUSTER_OBJECT_STORE_PROXY_CONTENT_LENGTH_REQUIRED: 'TeamCluster::ObjectStoreProxyContentLengthRequired',
    TEAM_CLUSTER_OBJECT_STORE_PROXY_FORBIDDEN: 'TeamCluster::ObjectStoreProxyForbidden',
    TEAM_CLUSTER_OBJECT_STORE_PROXY_INVALID_CONTENT_LENGTH: 'TeamCluster::ObjectStoreProxyInvalidContentLength',
    TEAM_CLUSTER_OBJECT_STORE_PROXY_INVALID_PATH: 'TeamCluster::ObjectStoreProxyInvalidPath',
    TEAM_CLUSTER_OBJECT_STORE_PROXY_OBJECT_KEY_REQUIRED: 'TeamCluster::ObjectStoreProxyObjectKeyRequired',
    TEAM_CLUSTER_OBJECT_STORE_PROXY_OWNER_NOT_FOUND: 'TeamCluster::ObjectStoreProxyOwnerNotFound',
    TEAM_CLUSTER_OBJECT_STORE_PROXY_ROUTE_NOT_FOUND: 'TeamCluster::ObjectStoreProxyRouteNotFound',
    TEAM_CLUSTER_OBJECT_STORE_PROXY_UNAUTHORIZED: 'TeamCluster::ObjectStoreProxyUnauthorized',
    TEAM_CLUSTER_PASSWORD_CONFIRMATION_UNAVAILABLE: 'TeamCluster::PasswordConfirmationUnavailable',
    TEAM_CLUSTER_REMOTE_ACCESS_SESSION_CLUSTER_MISMATCH: 'TeamCluster::RemoteAccessSessionClusterMismatch',
    TEAM_CLUSTER_REMOTE_ACCESS_SESSION_EXPIRED: 'TeamCluster::RemoteAccessSessionExpired',
    TEAM_CLUSTER_REMOTE_ACCESS_SESSION_FORBIDDEN: 'TeamCluster::RemoteAccessSessionForbidden',
    TEAM_CLUSTER_REMOTE_ACCESS_SESSION_NOT_FOUND: 'TeamCluster::RemoteAccessSessionNotFound',
    TEAM_CLUSTER_REMOTE_ACCESS_SESSION_TARGET_MISMATCH: 'TeamCluster::RemoteAccessSessionTargetMismatch',
    TEAM_CLUSTER_REMOTE_ACCESS_SESSION_TEAM_MISMATCH: 'TeamCluster::RemoteAccessSessionTeamMismatch',
    TEAM_CLUSTER_REMOTE_EXPLORER_OBJECT_NOT_FOUND: 'TeamCluster::RemoteExplorerObjectNotFound',
    TEAM_CLUSTER_STORAGE_CLUSTER_REQUIRED: 'TeamCluster::StorageClusterRequired',
    TRAJECTORY_ANALYSES_NO_COMPLETED_EXPORTS: 'Trajectory::Analyses::NoCompletedExports',
    TRAJECTORY_ANALYSES_NO_TIMESTEP_ARTIFACTS: 'Trajectory::Analyses::NoTimestepArtifacts',
    TRAJECTORY_INVALID_TIMESTEP: 'Trajectory::InvalidTimestep',
    TRAJECTORY_PARTICLE_FILTER_CONDITIONS_REQUIRED: 'Trajectory::ParticleFilterConditionsRequired',
    TRAJECTORY_STORAGE_CLUSTER_REQUIRED: 'Trajectory::StorageClusterRequired',
    TRAJECTORY_CLONE_STORAGE_CLUSTER_REQUIRED: 'TrajectoryClone::StorageClusterRequired',
    TRAJECTORY_UPLOAD_SESSION_ALREADY_COMMITTED: 'TrajectoryUploadSession::AlreadyCommitted',
    TRAJECTORY_UPLOAD_SESSION_FORBIDDEN: 'TrajectoryUploadSession::Forbidden',
    TRAJECTORY_UPLOAD_SESSION_UNSUPPORTED_RESOURCE: 'TrajectoryUploadSession::UnsupportedResource',
    WHITEBOARD_PAYLOAD_KEY_REQUIRED: 'Whiteboard::PayloadKeyRequired',
    WHITEBOARD_STORAGE_CLUSTER_REQUIRED: 'Whiteboard::StorageClusterRequired'
});

const ERROR_CODE_SET = new Set<string>(Object.values(ErrorCodes));

const isErrorCode = (value: unknown): value is ErrorCode => {
    return typeof value === 'string' && ERROR_CODE_SET.has(value);
};

/**
 * Narrows a code that arrived from outside this process — a daemon response, a
 * queue payload — to a registered `ErrorCode`, falling back when it is not one.
 *
 * Without this, a remote peer decides which codes reach the browser, and the
 * client's error table has no way to translate what it gets.
 */
export const toErrorCode = (value: unknown, fallback: ErrorCode): ErrorCode => {
    return isErrorCode(value) ? value : fallback;
};
