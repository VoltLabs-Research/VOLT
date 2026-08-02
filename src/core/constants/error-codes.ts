export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * `const T` is load-bearing: without it TypeScript widens each property to
 * `string` and `ErrorCode` silently becomes `string`, which defeats both the
 * `isErrorCode` guard and every `code: ErrorCode` parameter.
 */
const createErrorCodes = <const T extends Record<string, string>>(errorCodes: T): Readonly<T> => Object.freeze(errorCodes);

/**
 * Every code the daemon can put on the wire, in one place.
 *
 * The cloud maps a code to a user-facing message, so a code invented at the
 * throw site is untranslatable. All codes use the `Namespace::Code` convention;
 * some used to be written `SCREAMING_SNAKE` at the throw site and are normalized
 * here.
 */
export const ErrorCodes = createErrorCodes({
    ANALYSIS_START_EMPTY_EXECUTION_PLAN: 'Analysis::Start::EmptyExecutionPlan',
    ANALYSIS_START_INVALID_ENTRYPOINT: 'Analysis::Start::InvalidEntrypoint',
    ANALYSIS_START_MISSING_TIMESTEP: 'Analysis::Start::MissingTimestep',

    OBJECT_GATEWAY_BUCKET_NOT_ALLOWED: 'ObjectGateway::BucketNotAllowed',
    OBJECT_GATEWAY_DIRECT_ACCESS_TOKEN_REQUIRED: 'ObjectGateway::DirectAccessTokenRequired',
    OBJECT_GATEWAY_INVALID_DIRECT_ACCESS_TOKEN: 'ObjectGateway::InvalidDirectAccessToken',
    OBJECT_GATEWAY_INVALID_LIST_LIMIT: 'ObjectGateway::InvalidListLimit',
    OBJECT_GATEWAY_INVALID_PATH_ENCODING: 'ObjectGateway::InvalidPathEncoding',
    OBJECT_GATEWAY_INVALID_RANGE: 'ObjectGateway::InvalidRange',
    OBJECT_GATEWAY_MISSING_CONTENT_LENGTH: 'ObjectGateway::MissingContentLength',
    OBJECT_GATEWAY_MISSING_PREFIX: 'ObjectGateway::MissingPrefix',
    OBJECT_GATEWAY_OBJECT_NOT_FOUND: 'ObjectGateway::ObjectNotFound',
    OBJECT_GATEWAY_RANGE_NOT_SATISFIABLE: 'ObjectGateway::RangeNotSatisfiable',
    OBJECT_GATEWAY_ROUTE_NOT_FOUND: 'ObjectGateway::RouteNotFound',
    OBJECT_GATEWAY_UNSUPPORTED_COLLECTION_METHOD: 'ObjectGateway::UnsupportedCollectionMethod',
    OBJECT_GATEWAY_UNSUPPORTED_OBJECT_METHOD: 'ObjectGateway::UnsupportedObjectMethod',

    PLUGIN_REGISTRY_BINARY_MISSING: 'Plugin::RegistryBinaryMissing',
    PLUGIN_REGISTRY_CHECKSUM_MISMATCH: 'Plugin::RegistryChecksumMismatch',
    PLUGIN_REGISTRY_DOWNLOAD_FAILED: 'Plugin::RegistryDownloadFailed',
    PLUGIN_REGISTRY_WORKFLOW_MISSING: 'Plugin::RegistryWorkflowMissing',
    PLUGIN_SYNC_UNAVAILABLE: 'Plugin::SyncUnavailable',

    TRAJECTORY_UPLOAD_INCOMPLETE: 'Trajectory::Upload::Incomplete',
    TRAJECTORY_UPLOAD_SIZE_MISMATCH: 'Trajectory::Upload::SizeMismatch',
    TRAJECTORY_OWNER_CLUSTER_REQUIRED: 'Trajectory::OwnerClusterRequired',
    TRAJECTORY_CLONE_INVALID_TIMESTEP: 'TrajectoryClone::InvalidTimestep',

    WORKFLOW_TRACE: 'Workflow::Trace',

    // Normalized from SCREAMING_SNAKE literals that were written at the throw site.
    FILTER_EMPTY_RESULT: 'Filter::EmptyResult',
    FILTER_MASK_LENGTH_MISMATCH: 'Filter::MaskLengthMismatch',
    FILTER_PROPERTY_NOT_FOUND: 'Filter::PropertyNotFound',
    FILTER_STRING_OPERATOR_UNSUPPORTED: 'Filter::StringOperatorUnsupported',
    LINE_SCENE_SOURCE_NOT_FOUND: 'LineScene::SourceNotFound',
    MODIFIER_VALUES_UNAVAILABLE: 'Modifier::ValuesUnavailable'
});

const ERROR_CODE_SET = new Set<string>(Object.values(ErrorCodes));

export const isErrorCode = (value: unknown): value is ErrorCode => {
    return typeof value === 'string' && ERROR_CODE_SET.has(value);
};
