export const ERROR_CODE_MESSAGES: Record<string, string> = {
    // Authentication errors
    'Auth::Unauthorized': 'You are not authorized',
    'Auth::Credentials::Missing': 'Email and password are required',
    'Auth::Credentials::Invalid': 'Email or password are incorrect',
    'Auth::Username::MinLength': 'Username must be at least 4 characters long',
    'Auth::Username::MaxLength': 'Username cannot exceed 16 characters',
    'Auth::InvalidToken': 'Invalid authentication token',
    'Auth::TokenExpired': 'Authentication token has expired',
    'Authentication::Required': 'Please sign in to continue',
    'Authentication::Unauthorized': 'You are not authorized to perform this action',
    'Authentication::User::NotFound': 'User not found',
    'Authentication::User::ValidationError': 'User validation error',
    'Authentication::User::AccessDenied': 'Access denied',
    'Authentication::PasswordChanged': 'Your password was recently changed. Please sign in again',
    'Authentication::Session::Invalid': 'Your session has expired. Please sign in again',
    'Authentication::Guest::SeedRequired': 'Guest seed is required',
    'Authentication::Update::UserNotFound': 'User not found',
    'Authentication::Update::AvatarUploadFailed': 'Failed to upload avatar',
    'Authentication::Update::PasswordCurrentIncorrect': 'Current password is incorrect',
    'Authentication::Update::PasswordsAreSame': 'New password cannot be the same as current password',

    // Validation errors
    'Validation::Failed': 'Validation failed for one or more fields',
    'Validation::IdRequired': 'An ID is required for this operation',
    'Validation::InvalidObjectId': 'Invalid ID format',
    'Validation::InvalidTeamId': 'Invalid team ID format',
    'Validation::MissingRequiredFields': 'Required fields are missing',
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
    'User::NotFound': 'User not found',

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
    'Team::IdRequired': 'Team ID is required',
    'Team::AccessDenied': 'You do not have permission to access this team',
    'Team::LoadError': 'Failed to load team data',
    'Team::Membership::Forbidden': 'You are not a member of this team',
    'Team::Ownership::Forbidden': 'Only the team owner can perform this action',
    'Team::CannotRemoveOwner': 'The team owner cannot be removed',
    'Team::OwnerCannotLeave': 'The team owner cannot leave the team',
    'Team::UserNotAMember': 'User is not a member of this team',
    'Team::NotAuthorized': 'You are not authorized to perform this team action',
    'Team::InsufficientPermissions': 'You do not have sufficient permissions',
    'Team::Name::Required': 'Team name is required',
    'Team::Name::MinLength': 'Team name must be at least 3 characters long',
    'Team::Name::MaxLength': 'Team name cannot exceed 50 characters',
    'Team::Description::MaxLength': 'Team description cannot exceed 250 characters',
    'Team::Owner::Required': 'Team owner is required',

    // Team invitation errors
    'TeamInvitation::AlreadySent': 'Invitation already sent to this email',
    'TeamInvitation::UserAlreadyMember': 'User is already a member of this team',
    'TeamInvitation::Token::Required': 'Invitation token is required',
    'TeamInvitation::NotFound': 'Invitation not found',
    'TeamInvitation::AlreadyProcessed': 'This invitation has already been processed',
    'TeamInvitation::Expired': 'This invitation has expired',
    'TeamInvitation::Unauthorized': 'You are not authorized to process this invitation',
    'TeamInvitation::EmailRoleRequired': 'Email and role are required for the invitation',
    'TeamInvitation::InvalidEmail': 'Please provide a valid email address',
    'TeamInvitation::OwnerOnly': 'Only the team owner can send invitations',
    'TeamInvitation::InvalidUser': 'Invalid user for this invitation',

    // Team role errors
    'TeamRole::NotFound': 'Role not found',
    'TeamRole::IsSystem': 'System roles cannot be modified',
    'TeamRole::InUse': 'This role is currently in use and cannot be deleted',
    'TeamRole::NameRequired': 'Role name is required',

    // Team member errors
    'TeamMember::NotFound': 'Team member not found',
    'TeamMember::AlreadyExists': 'User is already a member of this team',
    'TeamMember::RoleRequired': 'A role is required for the team member',

    // Secret key errors
    'SecretKey::Required': 'Secret key is required',
    'SecretKey::Invalid': 'Invalid secret key',
    'SecretKey::NotFound': 'Secret key not found',
    'SecretKey::NameRequired': 'Secret key name is required',
    'SecretKey::RoleRequired': 'A role is required for the secret key',

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
    'Message:Forbidden': 'You do not have permission to modify this message',
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
    'Trajectory::TeamIdRequired': 'Team ID is required for this trajectory',
    'Trajectory::NotFound': 'Trajectory not found',
    'Trajectory::File::NotFound': 'Trajectory file not found',
    'Trajectory::Files::NotFound': 'Trajectory files not found',
    'Trajectory::Dump::NotFound': 'Trajectory data not found',
    'Trajectory::Creation::NoValidFiles': 'No valid files found to create trajectory',

    // Analysis errors
    'Analysis::NotFound': 'Analysis not found',
    'Analysis::ExecutionFailed': 'Analysis execution failed',

    // Plugin errors
    'Plugin::NotFound': 'Plugin not found',
    'Plugin::NotLoaded': 'Plugin could not be loaded',
    'Plugin::Validation::Failed': 'Plugin validation failed',
    'Plugin::Node::NotFound': 'Plugin node not found',
    'Plugin::Binary::Required': 'Plugin binary is required',
    'Plugin::Binary::PathRequired': 'Plugin binary path is required',
    'Plugin::Binary::InvalidPath': 'Invalid plugin binary path',
    'Plugin::Workflow::Required': 'Plugin workflow is required',
    'Plugin::NotValid::CannotPublish': 'Plugin is not valid and cannot be published',
    'Plugin::NotValid::CannotExecute': 'Plugin is not valid and cannot be executed',

    // Container errors
    'Container::NotFound': 'Container not found',
    'Container::AccessDenied': 'You do not have permission to access this container',
    'Container::LoadError': 'Failed to load container data',
    'Container::TeamIdRequired': 'Team ID is required for this container',
    'Container::Team::AccessDenied': 'You do not have permission to access this container team',
    'Container::Team::LoadError': 'Failed to load container team data',
    'Container::InvalidAction': 'Invalid container action',
    'Container::File::PathRequired': 'File path is required',
    'CONTAINER_CREATION_FAILED': 'Failed to create container',
    'CONTAINER_START_FAILED': 'Failed to start container',
    'CONTAINER_STOP_FAILED': 'Failed to stop container',
    'CONTAINER_DELETION_FAILED': 'Failed to delete container',
    'CONTAINER_STATS_FAILED': 'Failed to retrieve container statistics',
    'CONTAINER_FILE_READ_FAILED': 'Failed to read container file',
    'CONTAINER_EXEC_FAILED': 'Failed to execute command in container',
    'CONTAINER_NOT_FOUND': 'Container not found',
    'DOCKER_IMAGE_PULL_FAILED': 'Failed to pull Docker image',
    'DOCKER_CONNECT_ERROR': 'Failed to connect to Docker',

    // SSH errors
    'SSH::ConnectionId::Required': 'SSH connection ID is required',
    'SSHConnection::NotFound': 'SSH connection not found',
    'SSHConnection::LoadError': 'Failed to load SSH connection',
    'SSHConnection::MissingFields': 'Required SSH connection fields are missing',
    'SSHConnection::Name::Duplicate': 'An SSH connection with this name already exists',
    'SSHConnection::FetchError': 'Failed to fetch SSH connections',
    'SSHConnection::CreateError': 'Failed to create SSH connection',
    'SSHConnection::UpdateError': 'Failed to update SSH connection',
    'SSHConnection::DeleteError': 'Failed to delete SSH connection',
    'SSH::Import::MissingFields': 'Required fields for SSH import are missing',
    'SSH::ListFiles::Error': 'Failed to list files via SSH',
    'SSH::Path::NotFound': 'Path not found on remote server',
    'SSH::Import::NoFiles': 'No files found to import',
    'SSH::Import::Error': 'Failed to import files via SSH',

    // Color coding errors
    'ColorCoding::MissingParams': 'Required color coding parameters are missing',
    'ColorCoding::DumpNotFound': 'Color coding data not found',
    'ColorCoding::NotFound': 'Color coding not found',

    // Particle filter errors
    'ParticleFilter::InvalidAction': 'Invalid particle filter action',
    'ParticleFilter::AllDeleted': 'All particles would be deleted by this filter',

    // Raster errors
    'Raster::InvalidType': 'Invalid raster type',
    'Raster::NotFound': 'Raster data not found',
    'Raster::Failed': 'Raster operation failed',

    // Docker errors
    'Docker::Create::MissingImage': 'Docker image is required to create a container',
    'Docker::Create::Error': 'Failed to create Docker container',
    'Docker::Stop::Error': 'Failed to stop Docker container',
    'Docker::Remove::Error': 'Failed to remove Docker container',
    'Docker::Start::Error': 'Failed to start Docker container',
    'Docker::Stats::Error': 'Failed to retrieve Docker container statistics',
    'Docker::Inspect::Error': 'Failed to inspect Docker container',
    'Docker::Top::Error': 'Failed to list container processes',
    'Docker::Exec::Error': 'Failed to execute command in Docker container',
    'Docker::Stream::Error': 'Docker stream error',
    'Docker::Network::CreateError': 'Failed to create Docker network',
    'Docker::Network::RemoveError': 'Failed to remove Docker network',
    'Docker::Network::ConnectError': 'Failed to connect to Docker network',
    'Docker::Volume::CreateError': 'Failed to create Docker volume',
    'Docker::Volume::RemoveError': 'Failed to remove Docker volume',

    // Resource errors
    'Resource::NotFound': 'Resource not found',
    'Resource::LoadError': 'Failed to load resource',
    'Resource::LockConflict': 'Resource is locked by another operation',

    // Core errors
    'Core::APIFeatures::QueryExecutionFailed': 'Query execution failed',
    'Core::PageOutOfRange': 'Page number is out of range',
    'Core::PaginationError': 'Pagination error',

    // Access control errors
    'AccessControlService::Strategy::NotFound': 'Access control strategy not found',
    'AccessControlService::Access::MissingPermissions': 'You do not have the required permissions',

    // RBAC errors
    'RBAC::InsufficientPermissions': 'You do not have permission to perform this action',

    // OAuth errors
    'OAuth::Github::Email::NotFound': 'No public email found on your GitHub account. Please set a public email.',
    'OAuth::Strategy::Error': 'Authentication provider error. Please try again.',

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

    // HTTP errors(generic fallbacks)
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

export const getErrorMessage = (code: string, fallback: string = 'Unknown error'): string => {
    return ERROR_CODE_MESSAGES[code] || fallback;
};
