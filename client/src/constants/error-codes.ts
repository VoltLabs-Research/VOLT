export const ErrorCodes = {
    AUTH_UNAUTHORIZED: 'Auth::Unauthorized',
    AUTH_CREDENTIALS_MISSING: 'Auth::Credentials::Missing',
    AUTH_CREDENTIALS_INVALID: 'Auth::Credentials::Invalid',
    AUTHENTICATION_REQUIRED: 'Authentication::Required',
    AUTHENTICATION_UNAUTHORIZED: 'Authentication::Unauthorized',
    AUTHENTICATION_USER_NOT_FOUND: 'Authentication::User::NotFound',
    AUTHENTICATION_PASSWORD_CHANGED: 'Authentication::PasswordChanged',
    AUTHENTICATION_SESSION_INVALID: 'Authentication::Session::Invalid',
    AUTHENTICATION_GUEST_SEED_REQUIRED: 'Authentication::Guest::SeedRequired',
    AUTHENTICATION_UPDATE_AVATAR_FAILED: 'Authentication::Update::AvatarUploadFailed',
    AUTHENTICATION_UPDATE_PASSWORD_INCORRECT: 'Authentication::Update::PasswordCurrentIncorrect',
    USER_NOT_FOUND: 'User::NotFound',
    VALIDATION_ID_REQUIRED: 'Validation::IdRequired',
    VALIDATION_INVALID_OBJECT_ID: 'Validation::InvalidObjectId',
    VALIDATION_INVALID_TEAM_ID: 'Validation::InvalidTeamId',
    VALIDATION_MISSING_REQUIRED_FIELDS: 'Validation::MissingRequiredFields',
    TEAM_NOT_FOUND: 'Team::NotFound',
    TEAM_ID_REQUIRED: 'Team::IdRequired',
    TEAM_ACCESS_DENIED: 'Team::AccessDenied',
    TEAM_LOAD_ERROR: 'Team::LoadError',
    TEAM_MEMBERSHIP_FORBIDDEN: 'Team::Membership::Forbidden',
    TEAM_OWNERSHIP_FORBIDDEN: 'Team::Ownership::Forbidden',
    TEAM_CANNOT_REMOVE_OWNER: 'Team::CannotRemoveOwner',
    TEAM_USER_NOT_MEMBER: 'Team::UserNotAMember',
    CONTAINER_NOT_FOUND: 'Container::NotFound',
    CONTAINER_ACCESS_DENIED: 'Container::AccessDenied',
    CONTAINER_LOAD_ERROR: 'Container::LoadError',
    CONTAINER_TEAM_ID_REQUIRED: 'Container::TeamIdRequired',
    CONTAINER_TEAM_ACCESS_DENIED: 'Container::Team::AccessDenied',
    CONTAINER_TEAM_LOAD_ERROR: 'Container::Team::LoadError',
    CONTAINER_INVALID_ACTION: 'Container::InvalidAction',
    CONTAINER_FILE_PATH_REQUIRED: 'Container::File::PathRequired',
    API_TOKEN_REQUIRED: 'ApiToken::Required',
    API_TOKEN_INVALID: 'ApiToken::Invalid',
    API_TOKEN_EXPIRED: 'ApiToken::Expired',
    API_TOKEN_INACTIVE: 'ApiToken::Inactive',
    API_TOKEN_INSUFFICIENT_PERMISSIONS: 'ApiToken::InsufficientPermissions',
    API_TOKEN_INVALID_PERMISSIONS: 'ApiToken::InvalidPermissions',
    API_TOKEN_NOT_FOUND: 'ApiToken::NotFound',
    API_TOKEN_LOAD_ERROR: 'ApiToken::LoadError',
    SSH_CONNECTION_ID_REQUIRED: 'SSH::ConnectionId::Required',
    SSH_CONNECTION_NOT_FOUND: 'SSHConnection::NotFound',
    SSH_CONNECTION_LOAD_ERROR: 'SSHConnection::LoadError',
    SSH_CONNECTION_MISSING_FIELDS: 'SSHConnection::MissingFields',
    SSH_CONNECTION_NAME_DUPLICATE: 'SSHConnection::Name::Duplicate',
    SSH_CONNECTION_FETCH_ERROR: 'SSHConnection::FetchError',
    SSH_CONNECTION_CREATE_ERROR: 'SSHConnection::CreateError',
    SSH_CONNECTION_UPDATE_ERROR: 'SSHConnection::UpdateError',
    SSH_CONNECTION_DELETE_ERROR: 'SSHConnection::DeleteError',
    SSH_IMPORT_MISSING_FIELDS: 'SSH::Import::MissingFields',
    SSH_LIST_FILES_ERROR: 'SSH::ListFiles::Error',
    SSH_PATH_NOT_FOUND: 'SSH::Path::NotFound',
    SSH_IMPORT_NO_FILES: 'SSH::Import::NoFiles',
    SSH_IMPORT_ERROR: 'SSH::Import::Error',
    SESSION_NOT_FOUND: 'Session::NotFound',
    SESSION_GET_SESSIONS_FAILED: 'Session::GetSessions::Failed',
    SESSION_GET_LOGIN_ACTIVITY_FAILED: 'Session::GetLoginActivity::Failed',
    SESSION_REVOKE_FAILED: 'Session::RevokeSession::Failed',
    SESSION_REVOKE_ALL_FAILED: 'Session::RevokeAllOtherSessions::Failed',
    PASSWORD_VALIDATION_MISSING_FIELDS: 'Password::Validation::MissingFields',
    PASSWORD_VALIDATION_MISMATCH: 'Password::Validation::PasswordsDoNotMatch',
    PASSWORD_VALIDATION_TOO_SHORT: 'Password::Validation::PasswordTooShort',
    PASSWORD_USER_NOT_FOUND: 'Password::User::NotFound',
    PASSWORD_CURRENT_INCORRECT: 'Password::CurrentPassword::Incorrect',
    PASSWORD_SAME_AS_CURRENT: 'Password::NewPassword::SameAsCurrent',
    PASSWORD_CHANGE_FAILED: 'Password::ChangePassword::Failed',
    PASSWORD_GET_INFO_FAILED: 'Password::GetInfo::Failed',
    TRAJECTORY_TEAM_ID_REQUIRED: 'Trajectory::TeamIdRequired',
    TRAJECTORY_FILE_NOT_FOUND: 'Trajectory::File::NotFound',
    TRAJECTORY_FILES_NOT_FOUND: 'Trajectory::Files::NotFound',
    TRAJECTORY_CREATION_NO_VALID_FILES: 'Trajectory::Creation::NoValidFiles',
    TRAJECTORY_VFS_PATH_NOT_FOUND: 'TrajectoryVFS::PathNotFound',
    TRAJECTORY_VFS_INVALID_PATH: 'TrajectoryVFS::InvalidPath',
    TRAJECTORY_VFS_FILE_NOT_FOUND: 'TrajectoryVFS::FileNotFound',
    TRAJECTORY_VFS_FILE_SYSTEM_ERROR: 'TrajectoryVFS::FileSystemError',
    TRAJECTORY_VFS_DOWNLOAD_ERROR: 'TrajectoryVFS::DownloadError',
    TRAJECTORY_VFS_FETCH_ERROR: 'TrajectoryVFS::FetchError',
    ANALYSIS_NOT_FOUND: 'Analysis::NotFound',
    ANALYSIS_EXECUTION_FAILED: 'Analysis::ExecutionFailed',
    PLUGIN_NOT_FOUND: 'Plugin::NotFound',
    PLUGIN_NOT_LOADED: 'Plugin::NotLoaded',
    PLUGIN_VALIDATION_FAILED: 'Plugin::Validation::Failed',
    PLUGIN_NODE_NOT_FOUND: 'Plugin::Node::NotFound',
    PLUGIN_BINARY_REQUIRED: 'Plugin::Binary::Required',
    PLUGIN_BINARY_PATH_REQUIRED: 'Plugin::Binary::PathRequired',
    PLUGIN_BINARY_INVALID_PATH: 'Plugin::Binary::InvalidPath',
    WEBHOOK_NOT_FOUND: 'Webhook::NotFound',
    WEBHOOK_INVALID_EVENT_TYPE: 'Webhook::InvalidEventType',
    CHAT_NOT_FOUND: 'Chat::NotFound',
    CHAT_PARTICIPANTS_NOT_IN_TEAM: 'Chat::Participants::NotInTeam',
    CHAT_USERS_NOT_IN_TEAM: 'Chat::Users::NotInTeam',
    CHAT_USERS_NOT_PARTICIPANTS: 'Chat::Users::NotParticipants',
    CHAT_GROUP_MIN_PARTICIPANTS: 'Chat::Group::MinParticipants',
    CHAT_GROUP_MIN_ADMINS: 'Chat::Group::MinAdmins',
    CHAT_INVALID_ACTION: 'Chat::InvalidAction',
    MESSAGE_NOT_FOUND: 'Message::NotFound',
    FILE_NOT_FOUND: 'File::NotFound',
    FILE_READ_ERROR: 'File::ReadError',
    COLOR_CODING_MISSING_PARAMS: 'ColorCoding::MissingParams',
    COLOR_CODING_DUMP_NOT_FOUND: 'ColorCoding::DumpNotFound',
    COLOR_CODING_NOT_FOUND: 'ColorCoding::NotFound',
    RASTER_INVALID_TYPE: 'Raster::InvalidType',
    RASTER_NOT_FOUND: 'Raster::NotFound',
    RASTER_FAILED: 'Raster::Failed',
    DOCKER_CREATE_MISSING_IMAGE: 'Docker::Create::MissingImage',
    DOCKER_CREATE_ERROR: 'Docker::Create::Error',
    DOCKER_STOP_ERROR: 'Docker::Stop::Error',
    DOCKER_REMOVE_ERROR: 'Docker::Remove::Error',
    DOCKER_START_ERROR: 'Docker::Start::Error',
    DOCKER_STATS_ERROR: 'Docker::Stats::Error',
    DOCKER_INSPECT_ERROR: 'Docker::Inspect::Error',
    DOCKER_TOP_ERROR: 'Docker::Top::Error',
    DOCKER_EXEC_ERROR: 'Docker::Exec::Error',
    DOCKER_STREAM_ERROR: 'Docker::Stream::Error',
    CORE_API_FEATURES_QUERY_FAILED: 'Core::APIFeatures::QueryExecutionFailed',
    CORE_PAGE_OUT_OF_RANGE: 'Core::PageOutOfRange',
    CORE_PAGINATION_ERROR: 'Core::PaginationError',
    RESOURCE_NOT_FOUND: 'Resource::NotFound',
    RESOURCE_LOAD_ERROR: 'Resource::LoadError',
    TEAM_INVITATION_TOKEN_REQUIRED: 'TeamInvitation::Token::Required',
    TEAM_INVITATION_NOT_FOUND: 'TeamInvitation::NotFound',
    TEAM_INVITATION_ALREADY_PROCESSED: 'TeamInvitation::AlreadyProcessed',
    TEAM_INVITATION_EXPIRED: 'TeamInvitation::Expired',
    TEAM_INVITATION_UNAUTHORIZED: 'TeamInvitation::Unauthorized',
    TEAM_INVITATION_ALREADY_SENT: 'TeamInvitation::AlreadySent',
    TEAM_INVITATION_USER_ALREADY_MEMBER: 'TeamInvitation::UserAlreadyMember',
    TEAM_INVITATION_EMAIL_ROLE_REQUIRED: 'TeamInvitation::EmailRoleRequired',
    TEAM_INVITATION_INVALID_EMAIL: 'TeamInvitation::InvalidEmail',
    TEAM_INVITATION_OWNER_ONLY: 'TeamInvitation::OwnerOnly',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

export const ERROR_CODE_MESSAGES: Record<string, string> = {
    // Authentication errors
    'Auth::Credentials::Missing': 'Email and password are required',
    'Auth::Credentials::Invalid': 'Email or password are incorrect',
    'Auth::Username::MinLength': 'Username must be at least 4 characters long',
    'Auth::Username::MaxLength': 'Username cannot exceed 16 characters',
    'Auth::InvalidToken': 'Invalid authentication token',
    'Auth::TokenExpired': 'Authentication token has expired',
    'Authentication::User::NotFound': 'User not found',
    'Authentication::User::ValidationError': 'User validation error',
    'Authentication::User::AccessDenied': 'Access denied',
    'Authentication::Update::UserNotFound': 'User not found',
    'Authentication::Update::PasswordCurrentIncorrect': 'Current password is incorrect',
    'Authentication::Update::PasswordsAreSame': 'New password cannot be the same as current password',

    // Validation errors
    'Validation::Failed': 'Validation failed for one or more fields',
    'Internal::Server::Error': 'An unexpected error occurred',

    // User errors
    'User::Email::Required': 'Email is required',
    'User::Email::Validate': 'Please provide a valid email address',
    'User::Password::Required': 'Password is required',
    'User::Password::MinLength': 'Password must be at least 8 characters long',
    'User::Password::MaxLength': 'Password cannot exceed 16 characters',
    'User::FirstName::MinLength': 'First name must be at least 4 characters long',
    'User::FirstName::MaxLength': 'First name cannot exceed 16 characters',
    'User::LastName::MinLength': 'Last name must be at least 4 characters long',
    'User::LastName::MaxLength': 'Last name cannot exceed 16 characters',
    'User::Username::Required': 'Username is required',

    // Password errors
    'Password::Validation::MissingFields': 'Current password, new password, and confirmation are required',
    'Password::Validation::PasswordsDoNotMatch': 'Passwords do not match',
    'Password::Validation::PasswordTooShort': 'Password must be at least 8 characters long',
    'Password::User::NotFound': 'User not found',
    'Password::CurrentPassword::Incorrect': 'Current password is incorrect',
    'Password::NewPassword::SameAsCurrent': 'New password cannot be the same as current password',
    'Password::ChangePassword::Failed': 'Failed to change password',
    'Password::GetInfo::Failed': 'Failed to get password information',

    // Team errors
    'Team::NotFound': 'Team not found',
    'Team::ValidationError': 'Team validation error',
    'Team::AccessDenied': 'You do not have permission to access this team',
    'Team::Name::Required': 'Team name is required',
    'Team::Name::MinLength': 'Team name must be at least 3 characters long',
    'Team::Name::MaxLength': 'Team name cannot exceed 50 characters',
    'Team::Description::MaxLength': 'Team description cannot exceed 250 characters',
    'Team::Owner::Required': 'Team owner is required',

    // Chat errors
    'Chat::Team::NotFound': 'Team not found',
    'Chat::Participant::NotInTeam': 'Participant is not in this team',
    'Chat::NotFound': 'Chat not found',
    'Chat::Participants::NotInTeam': 'One or more participants are not in this team',
    'Chat::Users::NotInTeam': 'One or more users are not in this team',
    'Chat::Group::MinParticipants': 'Group chat requires at least 2 participants',
    'Chat::Users::NotParticipants': 'One or more users are not participants in this chat',
    'Chat::Group::MinAdmins': 'Group must have at least one administrator',
    'Chat::InvalidAction': 'Invalid action for this chat',

    // Message errors
    'Message::NotFound': 'Message not found',
    'Message::Forbidden': 'You do not have permission to modify this message',
    'Message::Content::Required': 'Message content is required',
    'Message::Content::MaxLength': 'Message cannot exceed 2000 characters',

    // File errors
    'File::NotFound': 'File not found',
    'File::ReadError': 'Error reading file',

    // Trajectory errors
    'Trajectory::Name::Required': 'Trajectory name is required',
    'Trajectory::Name::MinLength': 'Trajectory name must be at least 4 characters long',
    'Trajectory::Name::MaxLength': 'Trajectory name cannot exceed 64 characters',
    'Trajectory::InvalidPath': 'Invalid file path',
    'Trajectory::SymbolicLinksNotAllowed': 'Symbolic links are not allowed',
    'Trajectory::NoValidFiles': 'No valid files found for trajectory',
    'Trajectory::Team::InvalidId': 'Invalid team ID provided',

    // Notification errors
    'Notification::Title::Required': 'Notification title is required',
    'Notification::Content::Required': 'Notification content is required',

    // Session errors
    'Session::NotFound': 'Session not found',
    'Session::User::Required': 'Session user is required',
    'Session::Token::Required': 'Session token is required',
    'Session::UserAgent::Required': 'User agent is required',
    'Session::Ip::Required': 'IP address is required',
    'Session::Action::Required': 'Action is required',
    'Session::Success::Required': 'Success status is required',
    'Session::GetSessions::Failed': 'Failed to retrieve sessions',
    'Session::GetLoginActivity::Failed': 'Failed to retrieve login activity',
    'Session::RevokeSession::Failed': 'Failed to revoke session',
    'Session::RevokeAllOtherSessions::Failed': 'Failed to revoke all other sessions',

    // API Token errors
    'ApiToken::NotFound': 'API token not found',
    'ApiToken::InvalidPermissions': 'Invalid permissions provided',
    'ApiToken::Required': 'API token is required',
    'ApiToken::Invalid': 'Invalid API token',
    'ApiToken::Inactive': 'API token is inactive',
    'ApiToken::Expired': 'API token has expired',
    'ApiToken::InsufficientPermissions': 'Insufficient permissions for this operation',

    // API Tracker errors
    'ApiTracker::Method::Required': 'HTTP method is required',
    'ApiTracker::Url::Required': 'URL is required',
    'ApiTracker::Ip::Required': 'IP address is required',
    'ApiTracker::StatusCode::Required': 'Status code is required',
    'ApiTracker::StatusCode::Min': 'Invalid status code (minimum: 100)',
    'ApiTracker::StatusCode::Max': 'Invalid status code (maximum: 599)',
    'ApiTracker::ResponseTime::Required': 'Response time is required',
    'ApiTracker::ResponseTime::Min': 'Response time cannot be negative',

    // Webhook errors
    'Webhook::NotFound': 'Webhook not found',
    'Webhook::Events::AtLeastOneRequired': 'At least one event must be selected',
    'Webhook::Event::Invalid': 'Invalid event type provided',

    // Socket errors
    'Socket::Auth::TokenRequired': 'Authentication token is required for socket connection',
    'Socket::Auth::UserNotFound': 'User not found - cannot establish socket connection',
    'Socket::Auth::InvalidToken': 'Invalid authentication token for socket connection',

    // Handler errors
    'Handler::IDParameterRequired': 'ID parameter is required',

    // Database errors
    'Database::DuplicateKey': 'A record with this value already exists',
    'Database::InvalidId': 'Invalid ID format',

    // Service errors
    'CpuIntensiveTasks::Disabled': 'Analysis operations are temporarily disabled on this server. Please try again later or contact your administrator.',

    // HTTP errors (generic fallbacks)
    'Http::400': 'Bad Request',
    'Http::401': 'Unauthorized - Please sign in again',
    'Http::403': 'Forbidden',
    'Http::404': 'Resource not found',
    'Http::409': 'Conflict',
    'Http::429': 'Too many requests - Please try again later',
    'Http::500': 'Server error',
    'Http::502': 'Service temporarily unavailable',
    'Http::503': 'Service temporarily unavailable',
    'Http::504': 'Service temporarily unavailable',

    // Network errors
    'Network::Timeout': 'Request timeout - Check your connection',
    'Network::ConnectionError': 'Network connection error - Check your internet connection',
    'Network::Unknown': 'Network error - Please try again',

    // Generic errors
    'DefaultNotFound': 'Resource not found',
    'DefaultValidation': 'Validation error',
    'DefaultAccessDenied': 'Access denied',
};

/**
 * Get user-friendly error message for a given error code
 * Returns the mapped message or a fallback if not found
 */
export const getErrorMessage = (code: string, fallback: string = 'Unknown error'): string => {
    return ERROR_CODE_MESSAGES[code] || fallback;
};

/**
 * Check if an error code is known/mapped
 */
export const isKnownErrorCode = (code: string): boolean => {
    return code in ERROR_CODE_MESSAGES;
};