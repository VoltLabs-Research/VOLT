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

// Validation Codes Format: ModelName::Property::Type
export const ValidationCodes = {
    API_TRACKER_METHOD_REQUIRED: 'ApiTracker::Method::Required',
    API_TRACKER_URL_REQUIRED: 'ApiTracker::Url::Required',
    API_TRACKER_IP_REQUIRED: 'ApiTracker::Ip::Required',
    API_TRACKER_STATUS_CODE_REQUIRED: 'ApiTracker::StatusCode::Required',
    API_TRACKER_STATUS_CODE_MIN: 'ApiTracker::StatusCode::Min',
    API_TRACKER_STATUS_CODE_MAX: 'ApiTracker::StatusCode::Max',
    API_TRACKER_RESPONSE_TIME_REQUIRED: 'ApiTracker::ResponseTime::Required',
    API_TRACKER_RESPONSE_TIME_MIN: 'ApiTracker::ResponseTime::Min',

    CONTAINER_NAME_REQUIRED: 'Container::Name::Required',
    CONTAINER_IMAGE_REQUIRED: 'Container::Image::Required',
    CONTAINER_ID_REQUIRED: 'Container::ContainerId::Required',
    CONTAINER_CREATED_BY_REQUIRED: 'Container::CreatedBy::Required',

    DOCKER_NETWORK_ID_REQUIRED: 'DockerNetwork::NetworkId::Required',
    DOCKER_NETWORK_NAME_REQUIRED: 'DockerNetwork::Name::Required',

    DOCKER_VOLUME_ID_REQUIRED: 'DockerVolume::VolumeId::Required',
    DOCKER_VOLUME_NAME_REQUIRED: 'DockerVolume::Name::Required',

    MESSAGE_CONTENT_REQUIRED: 'Message::Content::Required',
    MESSAGE_CONTENT_MAXLEN: 'Message::Content::MaxLength',

    NOTIFICATION_TITLE_REQUIRED: 'Notification::Title::Required',
    NOTIFICATION_CONTENT_REQUIRED: 'Notification::Content::Required',

    PLUGIN_ARGUMENT_OPT_KEY_REQUIRED: 'Plugin::ArgumentOption::Key::Required',
    PLUGIN_ARGUMENT_OPT_LABEL_REQUIRED: 'Plugin::ArgumentOption::Label::Required',
    PLUGIN_ARGUMENT_DEF_ARGUMENT_REQUIRED: 'Plugin::ArgumentDefinition::Argument::Required',
    PLUGIN_ARGUMENT_DEF_TYPE_REQUIRED: 'Plugin::ArgumentDefinition::Type::Required',
    PLUGIN_ARGUMENT_DEF_LABEL_REQUIRED: 'Plugin::ArgumentDefinition::Label::Required',
    PLUGIN_MODIFIER_NAME_REQUIRED: 'Plugin::ModifierData::Name::Required',
    PLUGIN_CONTEXT_SOURCE_REQUIRED: 'Plugin::ContextData::Source::Required',
    PLUGIN_FOREACH_ITERABLE_SOURCE_REQUIRED: 'Plugin::ForeachData::IterableSource::Required',
    PLUGIN_ENTRYPOINT_BINARY_REQUIRED: 'Plugin::Entrypoint::Binary::Required',
    PLUGIN_ENTRYPOINT_ARGUMENTS_REQUIRED: 'Plugin::Entrypoint::Arguments::Required',
    PLUGIN_EXPOSURE_NAME_REQUIRED: 'Plugin::Exposure::Name::Required',
    PLUGIN_EXPOSURE_RESULTS_REQUIRED: 'Plugin::Exposure::Results::Required',
    PLUGIN_SCHEMA_DEFINITION_REQUIRED: 'Plugin::Schema::Definition::Required',
    PLUGIN_EXPORT_EXPORTER_REQUIRED: 'Plugin::Export::Exporter::Required',
    PLUGIN_EXPORT_TYPE_REQUIRED: 'Plugin::Export::Exporter::Type',
    PLUGIN_POSITION_X_REQUIRED: 'Plugin::Position::X::Required',
    PLUGIN_POSITION_Y_REQUIRED: 'Plugin::Position::Y::Required',
    PLUGIN_WORKFLOW_NODE_ID_REQUIRED: 'Plugin::WorkflowNode::Id::Required',
    PLUGIN_WORKFLOW_NODE_TYPE_REQUIRED: 'Plugin::WorkflowNode::Type::Required',
    PLUGIN_WORKFLOW_NODE_POSITION_REQUIRED: 'Plugin::WorkflowNode::Position::Required',
    PLUGIN_WORKFLOW_EDGE_ID_REQUIRED: 'Plugin::WorkflowEdge::Id::Required',
    PLUGIN_WORKFLOW_EDGE_SOURCE_REQUIRED: 'Plugin::WorkflowEdge::Source::Required',
    PLUGIN_WORKFLOW_EDGE_TARGET_REQUIRED: 'Plugin::WorkflowEdge::Target::Required',
    PLUGIN_SLUG_REQUIRED: 'Plugin::Slug::Required',
    PLUGIN_WORKFLOW_REQUIRED: 'Plugin::Workflow::Required',

    SESSION_SUCCESS_REQUIRED: 'Session::Success::Required',
    SESSION_ACTION_REQUIRED: 'Session::Action::Required',
    SESSION_IP_REQUIRED: 'Session::Ip::Required',
    SESSION_USER_AGENT_REQUIRED: 'Session::UserAgent::Required',
    SESSION_TOKEN_REQUIRED: 'Session::Token::Required',
    SESSION_USER_REQUIRED: 'Session::User::Required',

    SSH_CONNECTION_NAME_REQUIRED: 'SSHConnection::Name::Required',
    SSH_CONNECTION_NAME_DUPLICATED: 'SSHConnection::Name::Duplicated',
    SSH_CONNECTION_MINLEN: 'SSHConnection::Name::MinLength',
    SSH_CONNECTION_MAXLEN: 'SSHConnection::Name::MaxLength',
    SSH_CONNECTION_HOST: 'SSHConenction::Host::Required',
    SSH_CONNECTION_HOST_INVALID: 'SSHConnection::Host::Invalid',
    SSH_CONNECTION_PORT_REQUIRED: 'SSHConnection::Port::Required',
    SSH_CONNECTION_PORT_MIN: 'SSHConnection::Port::Min',
    SSH_CONNECTION_PORT_MAX: 'SSHConnection::Port::Max',
    SSH_CONNECTION_USERNAME_REQUIRED: 'SSHConnection::Username::Required',
    SSH_CONNECTION_USERNAME_MAXLEN: 'SSHConnection::Username::MaxLength',
    SSH_CONNECTION_USERNAME_MINLEN: 'SSHConnection::Username::MinLength',
    SSH_CONNECTION_ENCRYPTED_PASSWORD: 'SSHConnection::Password::Required',
    SSH_CONNECTION_USER: 'SSHConnection::User::Required',
    SSH_CONNECTION_TEAM: 'SSHConnection::Team::Required',

    TEAM_INVITATION_TEAM_REQUIRED: 'TeamInvitation::Team::Required',
    TEAM_INVITATION_INVITED_BY_REQUIRED: 'TeamInvitation::InvitedBy::Required',
    TEAM_INVITATION_EMAIL_REQUIRED: 'TeamInvitation::Email::Required',
    TEAM_INVITATION_EMAIL_INVALID: 'TeamInvitation::Email::Invalid',
    TEAM_INVITATION_TOKEN_REQUIRED: 'TeamInvitation::Token::Required',
    TEAM_INVITATION_ROLE_INVALID: 'TeamInvitation::Role::Invalid',
    TEAM_INVITATION_EXPIRES_AT_REQUIRED: 'TeamInvitation::ExpiresAt::Required',
    TEAM_INVITATION_STATUS_INVALID: 'TeamInvitation::Status::Invalid',

    TEAM_NAME_REQUIRED: 'Team::Name::Required',
    TEAM_NAME_MINLEN: 'Team::Name::MinLength',
    TEAM_NAME_MAXLEN: 'Team::Name::MaxLength',
    TEAM_NAME_DESCRIPTION_MAXLEN: 'Team::Description::MaxLength',
    TEAM_OWNER_REQUIRED: 'Team::Owner::Required',

    TRAJECTORY_NAME_REQUIRED: 'Trajectory::Name::Required',
    TRAJECTORY_NAME_MINLEN: 'Trajectory::Name::MinLength',
    TRAJECTORY_NAME_MAXLEN: 'Trajectory::Name::MaxLength',

    USER_EMAIL_REQUIRED: 'User::Email::Required',
    USER_EMAIL_INVALID: 'User::Email::Invalid',
    USER_PASSWORD_MINLEN: 'User::Password::MinLength',
    USER_PASSWORD_MAXLEN: 'User::Password::MaxLength',
    USER_FIRST_NAME_MINLEN: 'User::FirstName::MinLength',
    USER_FIRST_NAME_MAXLEN: 'User::FirstName::MaxLength',
    USER_FIRST_NAME_REQUIRED: 'User::Username::Required',
    USER_LAST_NAME_REQUIRED: 'User::LastName::Required',
    USER_LAST_NAME_MINLEN: 'User::LastName::MinLength',
    USER_LAST_NAME_MAXLEN: 'User::LastName::MaxLength',

    CHAT_PARTICIPANTS_REQUIRED: 'Chat::Participants::Required',
    CHAT_TEAM_REQUIRED: 'Chat::Team::Required'
};
