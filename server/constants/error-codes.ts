/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

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

    TEAM_NOT_FOUND: 'Team::NotFound',
    TEAM_ID_REQUIRED: 'Team::IdRequired',
    TEAM_ACCESS_DENIED: 'Team::AccessDenied',
    TEAM_LOAD_ERROR: 'Team::LoadError',
    TEAM_MEMBERSHIP_FORBIDDEN: 'Team::Membership::Forbidden',
    TEAM_OWNERSHIP_FORBIDDEN: 'Team::Ownership::Forbidden',
    TEAM_CANNOT_REMOVE_OWNER: 'Team::CannotRemoveOwner',
    TEAM_USER_NOT_MEMBER: 'Team::UserNotAMember',
    TEAM_NOT_AUTHORIZED: 'Team::NotAuthorized',
    TEAM_INSUFFICIENT_PERMISSIONS: 'Team::InsufficientPermissions',

    CONTAINER_NOT_FOUND: 'Container::NotFound',
    CONTAINER_ACCESS_DENIED: 'Container::AccessDenied',
    CONTAINER_LOAD_ERROR: 'Container::LoadError',
    CONTAINER_TEAM_ID_REQUIRED: 'Container::TeamIdRequired',
    CONTAINER_TEAM_ACCESS_DENIED: 'Container::Team::AccessDenied',
    CONTAINER_TEAM_LOAD_ERROR: 'Container::Team::LoadError',
    CONTAINER_INVALID_ACTION: 'Container::InvalidAction',
    CONTAINER_FILE_PATH_REQUIRED: 'Container::File::PathRequired',

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

    CHAT_NOT_FOUND: 'Chat::NotFound',
    CHAT_PARTICIPANTS_NOT_IN_TEAM: 'Chat::Participants::NotInTeam',
    CHAT_USERS_NOT_IN_TEAM: 'Chat::Users::NotInTeam',
    CHAT_USERS_NOT_PARTICIPANTS: 'Chat::Users::NotParticipants',
    CHAT_GROUP_MIN_PARTICIPANTS: 'Chat::Group::MinParticipants',
    CHAT_GROUP_MIN_ADMINS: 'Chat::Group::MinAdmins',
    CHAT_INVALID_ACTION: 'Chat::InvalidAction',

    MESSAGE_NOT_FOUND: 'Message::NotFound',
    MESSAGE_FORBIDDEN: 'Message:Forbidden',

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
    VALIDATION_MISSING_REQUIRED_FIELDS: 'Validation::MissingRequiredFields',

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

    PLUGIN_WORKFLOW_REQUIRED: 'Plugin::Workflow::Required',
    PLUGIN_NOT_VALID_CANNOT_PUBLISH: 'Plugin::NotValid::CannotPublish',
    PLUGIN_NOT_VALID_CANNOT_EXECUTE: 'Plugin::NotValid::CannotExecute',

    TRAJECTORY_NOT_FOUND: 'Trajectory::NotFound',
    TRAJECTORY_DUMP_NOT_FOUND: 'Trajectory::Dump::NotFound',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
