export const ERROR_CODE_MESSAGES: Record<string, string> = {
    // Authentication errors
    'Auth::Credentials::Missing': 'Email and password are required',
    'Auth::Credentials::Invalid': 'Email or password are incorrect',
    'Auth::Username::MinLength': 'Username must be at least 4 characters long',
    'Auth::Username::MaxLength': 'Username cannot exceed 16 characters',
    'Authentication::User::NotFound': 'User not found',
    'Authentication::User::ValidationError': 'User validation error',
    'Authentication::User::AccessDenied': 'Access denied',
    'Authentication::Update::UserNotFound': 'User not found',
    'Authentication::Update::PasswordCurrentIncorrect': 'Current password is incorrect',
    'Authentication::Update::PasswordsAreSame': 'New password cannot be the same as current password',

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