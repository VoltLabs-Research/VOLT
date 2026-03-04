export const ErrorCodes = {
    AUTH_UNAUTHORIZED: 'Auth::Unauthorized',
    AUTH_CREDENTIALS_MISSING: 'Auth::Credentials::Missing',
    AUTH_CREDENTIALS_INVALID: 'Auth::Credentials::Invalid',

    AUTHENTICATION_REQUIRED: 'Authentication::Required',
    AUTHENTICATION_UNAUTHORIZED: 'Authentication::Unauthorized',
    AUTHENTICATION_GUEST_SEED_REQUIRED: 'Authentication::Guest::SeedRequired',
    AUTHENTICATION_UPDATE_PASSWORD_INCORRECT: 'Authentication::Update::PasswordCurrentIncorrect',

    USER_NOT_FOUND: 'User::NotFound',

    VALIDATION_ID_REQUIRED: 'Validation::IdRequired',

    TEAM_NOT_FOUND: 'Team::NotFound',
    TEAM_ID_REQUIRED: 'Team::IdRequired',
    TEAM_ACCESS_DENIED: 'Team::AccessDenied',
    TEAM_MEMBERSHIP_FORBIDDEN: 'Team::Membership::Forbidden',
    TEAM_USER_NOT_MEMBER: 'Team::UserNotAMember',

    CONTAINER_NOT_FOUND: 'Container::NotFound',
    CONTAINER_CREATION_FAILED: 'Container::Creation::Failed',
    CONTAINER_START_FAILED: 'Container::Start::Failed',
    CONTAINER_STOP_FAILED: 'Container::Stop::Failed',
    CONTAINER_DELETION_FAILED: 'Container::Deletion::Failed',
    CONTAINER_STATS_FAILED: 'Container::Stats::Failed',
    CONTAINER_FILE_READ_FAILED: 'Container::File::ReadFailed',
    CONTAINER_EXEC_FAILED: 'Container::Exec::Failed',

    SSH_CONNECTION_ID_REQUIRED: 'SSH::ConnectionId::Required',
    SSH_CONNECTION_NOT_FOUND: 'SSHConnection::NotFound',
    SSH_CONNECTION_UPDATE_ERROR: 'SSHConnection::UpdateError',
    SSH_CONNECTION_DELETE_ERROR: 'SSHConnection::DeleteError',
    SSH_LIST_FILES_ERROR: 'SSH::ListFiles::Error',
    SSH_PATH_NOT_FOUND: 'SSH::Path::NotFound',
    SSH_IMPORT_NO_FILES: 'SSH::Import::NoFiles',
    SSH_IMPORT_ERROR: 'SSH::Import::Error',

    SESSION_NOT_FOUND: 'Session::NotFound',
    SESSION_REVOKE_FAILED: 'Session::RevokeSession::Failed',

    TRAJECTORY_CREATION_NO_VALID_FILES: 'Trajectory::Creation::NoValidFiles',

    ANALYSIS_NOT_FOUND: 'Analysis::NotFound',

    PLUGIN_NOT_FOUND: 'Plugin::NotFound',
    PLUGIN_NODE_NOT_FOUND: 'Plugin::Node::NotFound',

    CHAT_NOT_FOUND: 'Chat::NotFound',
    CHAT_USERS_NOT_IN_TEAM: 'Chat::Users::NotInTeam',
    CHAT_GROUP_MIN_PARTICIPANTS: 'Chat::Group::MinParticipants',
    CHAT_GROUP_MIN_ADMINS: 'Chat::Group::MinAdmins',
    CHAT_INVALID_ACTION: 'Chat::InvalidAction',

    MESSAGE_NOT_FOUND: 'Message::NotFound',
    MESSAGE_FORBIDDEN: 'Message:Forbidden',

    FILE_NOT_FOUND: 'File::NotFound',
    FILE_READ_ERROR: 'File::ReadError',

    COLOR_CODING_MISSING_PARAMS: 'ColorCoding::MissingParams',
    COLOR_CODING_DUMP_NOT_FOUND: 'ColorCoding::DumpNotFound',

    PARTICLE_FILTER_INVALID_ACTION: 'ParticleFilter::InvalidAction',
    PARTICLE_FILTER_ALL_DELETED: 'ParticleFilter::AllDeleted',

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
    TRAJECTORY_DUMP_NOT_FOUND: 'Trajectory::Dump::NotFound',

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
    OAUTH_STRATEGY_ERROR: 'OAuth::Strategy::Error'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
