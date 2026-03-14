export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

const createErrorCodes = <T extends Record<string, string>>(errorCodes: T): Readonly<T> => Object.freeze(errorCodes);

export const ErrorCodes = createErrorCodes({
    INTERNAL_SERVER_ERROR: 'Internal::Server::Error',
    WORKER_FAILURE: 'Worker::Failure',
    WORKER_TIMEOUT: 'Worker::Timeout',
    WORKER_EXIT_ERROR: 'Worker::ExitError',
    JOB_CANCELLED: 'Job::Cancelled',
    RASTER_WORKER_DOWNLOAD_FAILED: 'Raster::Worker::DownloadFailed',
    RASTER_WORKER_INPUT_NOT_FOUND: 'Raster::Worker::InputNotFound',
    RASTER_WORKER_RENDER_FAILED: 'Raster::Worker::RenderFailed',
    RASTER_WORKER_OUTPUT_INVALID: 'Raster::Worker::OutputInvalid',
    RASTER_WORKER_UPLOAD_FAILED: 'Raster::Worker::UploadFailed',

    AUTH_UNAUTHORIZED: 'Auth::Unauthorized',
    AUTH_CREDENTIALS_MISSING: 'Auth::Credentials::Missing',
    AUTH_CREDENTIALS_INVALID: 'Auth::Credentials::Invalid',

    AUTHENTICATION_REQUIRED: 'Authentication::Required',
    AUTHENTICATION_UNAUTHORIZED: 'Authentication::Unauthorized',
    AUTHENTICATION_GUEST_SEED_REQUIRED: 'Authentication::Guest::SeedRequired',
    AUTHENTICATION_UPDATE_PASSWORD_INCORRECT: 'Authentication::Update::PasswordCurrentIncorrect',

    USER_NOT_FOUND: 'User::NotFound',

    VALIDATION_ID_REQUIRED: 'Validation::IdRequired',
    VALIDATION_INVALID_INPUT: 'Validation::InvalidInput',

    TEAM_NOT_FOUND: 'Team::NotFound',
    TEAM_ID_REQUIRED: 'Team::IdRequired',
    TEAM_ACCESS_DENIED: 'Team::AccessDenied',
    TEAM_CLUSTER_NOT_FOUND: 'TeamCluster::NotFound',
    RBAC_INSUFFICIENT_PERMISSIONS: 'RBAC::InsufficientPermissions',
    TEAM_MEMBERSHIP_FORBIDDEN: 'Team::Membership::Forbidden',
    TEAM_USER_NOT_MEMBER: 'Team::UserNotAMember',

    CONTAINER_NOT_FOUND: 'Container::NotFound',
    CONTAINER_CREATION_FAILED: 'Container::Creation::Failed',
    CONTAINER_START_FAILED: 'Container::Start::Failed',
    CONTAINER_STOP_FAILED: 'Container::Stop::Failed',
    CONTAINER_DELETION_FAILED: 'Container::Deletion::Failed',
    CONTAINER_STATS_FAILED: 'Container::Stats::Failed',
    CONTAINER_FILE_READ_FAILED: 'Container::File::ReadFailed',
    CONTAINER_FILE_IS_DIRECTORY: 'Container::File::IsDirectory',
    CONTAINER_FILE_BINARY_UNSUPPORTED: 'Container::File::BinaryUnsupported',
    CONTAINER_EXEC_FAILED: 'Container::Exec::Failed',

    SSH_CONNECTION_NOT_FOUND: 'SSHConnection::NotFound',
    SSH_CONNECTION_UPDATE_ERROR: 'SSHConnection::UpdateError',
    SSH_CONNECTION_DELETE_ERROR: 'SSHConnection::DeleteError',
    SSH_AUTH_FAILED: 'SSH::Auth::Failed',
    SSH_CONNECTION_REFUSED: 'SSH::Connection::Refused',
    SSH_CONNECTION_TIMEOUT: 'SSH::Connection::Timeout',
    SSH_HOST_UNREACHABLE: 'SSH::Host::Unreachable',
    SSH_DECRYPTION_FAILED: 'SSH::Decryption::Failed',
    SSH_LIST_FILES_ERROR: 'SSH::ListFiles::Error',
    SSH_PATH_NOT_FOUND: 'SSH::Path::NotFound',
    SSH_IMPORT_NO_FILES: 'SSH::Import::NoFiles',
    SSH_IMPORT_ERROR: 'SSH::Import::Error',

    SESSION_NOT_FOUND: 'Session::NotFound',
    SESSION_REVOKE_FAILED: 'Session::RevokeSession::Failed',

    SIMULATION_CELL_NOT_FOUND: 'SimulationCell::NotFound',

    TRAJECTORY_CREATION_NO_VALID_FILES: 'Trajectory::Creation::NoValidFiles',

    ANALYSIS_NOT_FOUND: 'Analysis::NotFound',

    PLUGIN_NOT_FOUND: 'Plugin::NotFound',
    PLUGIN_NODE_NOT_FOUND: 'Plugin::Node::NotFound',
    PLUGIN_EXECUTOR_BINARY_NOT_ACCESSIBLE: 'Plugin::Executor::Binary::NotAccessible',
    PLUGIN_EXECUTOR_START_FAILED: 'Plugin::Executor::Start::Failed',
    PLUGIN_EXECUTOR_EXIT_FAILED: 'Plugin::Executor::Exit::Failed',
    PLUGIN_CONTEXT_SOURCE_UNSUPPORTED: 'Plugin::Context::Source::Unsupported',
    PLUGIN_FOREACH_SOURCE_REQUIRED: 'Plugin::ForEach::Source::Required',
    PLUGIN_FOREACH_SOURCE_INVALID: 'Plugin::ForEach::Source::Invalid',
    PLUGIN_ENTRYPOINT_BINARY_REQUIRED: 'Plugin::Entrypoint::Binary::Required',
    PLUGIN_ENTRYPOINT_FOREACH_REQUIRED: 'Plugin::Entrypoint::ForEach::Required',
    PLUGIN_ENTRYPOINT_ITERATION_MISSING: 'Plugin::Entrypoint::Iteration::Missing',
    PLUGIN_EXPOSURE_INPUT_REQUIRED: 'Plugin::Exposure::Input::Required',
    PLUGIN_EXPORT_EXPOSURE_REQUIRED: 'Plugin::Export::Exposure::Required',
    PLUGIN_EXPORT_EXPOSURE_NAME_REQUIRED: 'Plugin::Export::ExposureName::Required',
    PLUGIN_EXPORT_DATA_REQUIRED: 'Plugin::Export::Data::Required',
    PLUGIN_EXPORT_TYPE_UNSUPPORTED: 'Plugin::Export::Type::Unsupported',

    CHAT_NOT_FOUND: 'Chat::NotFound',
    CHAT_USERS_NOT_IN_TEAM: 'Chat::Users::NotInTeam',
    CHAT_GROUP_MIN_PARTICIPANTS: 'Chat::Group::MinParticipants',
    CHAT_GROUP_MIN_ADMINS: 'Chat::Group::MinAdmins',
    CHAT_INVALID_ACTION: 'Chat::InvalidAction',

    MESSAGE_NOT_FOUND: 'Message::NotFound',
    MESSAGE_FORBIDDEN: 'Message:Forbidden',

    FILE_NOT_FOUND: 'File::NotFound',
    FILE_READ_ERROR: 'File::ReadError',

    RASTER_NOT_FOUND: 'Raster::NotFound',
    RASTER_FAILED: 'Raster::Failed',

    COLOR_CODING_MISSING_PARAMS: 'ColorCoding::MissingParams',
    COLOR_CODING_DUMP_NOT_FOUND: 'ColorCoding::DumpNotFound',

    PARTICLE_FILTER_INVALID_ACTION: 'ParticleFilter::InvalidAction',

    DOCKER_CREATE_ERROR: 'Docker::Create::Error',
    DOCKER_EXEC_ERROR: 'Docker::Exec::Error',
    DOCKER_CONNECT_ERROR: 'Docker::Connect::Error',

    RESOURCE_NOT_FOUND: 'Resource::NotFound',
    RESOURCE_LOAD_ERROR: 'Resource::LoadError',
    VALIDATION_MISSING_REQUIRED_FIELDS: 'Validation::MissingRequiredFields',

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
    TRAJECTORY_TEAM_CLUSTER_REQUIRED: 'Trajectory::TeamCluster::Required',
    TRAJECTORY_DUMP_NOT_FOUND: 'Trajectory::Dump::NotFound',
    TRAJECTORY_FORMAT_UNSUPPORTED: 'Trajectory::Format::Unsupported',
    TRAJECTORY_DATA_PARSE_FAILED: 'Trajectory::Data::ParseFailed',
    TRAJECTORY_DUMP_PARSE_FAILED: 'Trajectory::Dump::ParseFailed',
    TRAJECTORY_STATS_PARSE_FAILED: 'Trajectory::Stats::ParseFailed',
    TRAJECTORY_GLB_GENERATION_FAILED: 'Trajectory::GLB::GenerationFailed',
    TRAJECTORY_ATOMS_EXPOSURE_ID_REQUIRED: 'Trajectory::Atoms::ExposureIdRequired',
    TRAJECTORY_ATOMS_PLUGIN_FETCH_FAILED: 'Trajectory::Atoms::PluginFetchFailed',

    TEAM_ROLE_NOT_FOUND: 'TeamRole::NotFound',
    TEAM_ROLE_IS_SYSTEM: 'TeamRole::IsSystem',
    TEAM_ROLE_NAME_REQUIRED: 'TeamRole::NameRequired',

    TEAM_MEMBER_NOT_FOUND: 'TeamMember::NotFound',
    TEAM_MEMBER_ALREADY_EXISTS: 'TeamMember::AlreadyExists',

    TEAM_AI_INTEGRATION_NOT_FOUND: 'TeamAIIntegration::NotFound',
    TEAM_AI_INTEGRATION_ALREADY_EXISTS: 'TeamAIIntegration::AlreadyExists',
    TEAM_AI_INTEGRATION_PROVIDER_UNSUPPORTED: 'TeamAIIntegration::Provider::Unsupported',
    TEAM_AI_INTEGRATION_API_KEY_REQUIRED: 'TeamAIIntegration::ApiKey::Required',
    TEAM_AI_INTEGRATION_MODEL_UNSUPPORTED: 'TeamAIIntegration::Model::Unsupported',

    SECRET_KEY_INVALID: 'SecretKey::Invalid',
    SECRET_KEY_NOT_FOUND: 'SecretKey::NotFound',
    SECRET_KEY_NAME_REQUIRED: 'SecretKey::NameRequired',
    SECRET_KEY_ROLE_REQUIRED: 'SecretKey::RoleRequired',
    SECRET_KEY_PARAMS_REQUIRED: 'SecretKey::ParamsRequired',

    AI_CONVERSATION_NOT_FOUND: 'AI::Conversation::NotFound',
    AI_INTEGRATION_NOT_CONFIGURED: 'AI::Integration::NotConfigured',
    AI_PROVIDER_UNAVAILABLE: 'AI::Provider::Unavailable',
    OAUTH_STRATEGY_ERROR: 'OAuth::Strategy::Error',

    SCRIPTING_SESSION_FAILED: 'Scripting::Session::Failed',
    SCRIPTING_DAEMON_UNAVAILABLE: 'Scripting::Daemon::Unavailable',
    SCRIPTING_NOTEBOOK_NOT_FOUND: 'Scripting::Notebook::NotFound',
    SCRIPTING_LOCK_FAILED: 'Scripting::Lock::Failed',

    TEAM_INVITE_CODE_NOT_FOUND: 'TeamInviteCode::NotFound',
    TEAM_INVITE_CODE_ALREADY_MEMBER: 'TeamInviteCode::AlreadyMember',

    LATEX_COMPILER_NOT_FOUND: 'Latex::Compiler::NotFound',
    LATEX_COMPILATION_FAILED: 'Latex::Compilation::Failed',
    LATEX_FILE_NOT_FOUND: 'Latex::File::NotFound'
});

export const isErrorCode = (value: string): value is ErrorCode => {
    return Object.values(ErrorCodes).some((errorCode) => errorCode === value);
};
