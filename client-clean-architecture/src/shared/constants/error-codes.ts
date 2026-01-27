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

export const getErrorMessage = (code: string, fallback: string = 'Unknown error'): string => {
    return ERROR_CODE_MESSAGES[code] || fallback;
};

export const isKnownErrorCode = (code: string): boolean => {
    return code in ERROR_CODE_MESSAGES;
};
