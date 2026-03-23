import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { readBooleanEnv } from '@shared/infrastructure/utilities/env';

type ObjectGatewayAccessKind = 'read' | 'write';

const OBJECT_GATEWAY_ENABLED_ENV = 'TEAM_CLUSTER_OBJECT_GATEWAY_ENABLED';
const OBJECT_GATEWAY_READS_ENABLED_ENV = 'TEAM_CLUSTER_OBJECT_GATEWAY_READS_ENABLED';
const OBJECT_GATEWAY_WRITES_ENABLED_ENV = 'TEAM_CLUSTER_OBJECT_GATEWAY_WRITES_ENABLED';

export const isObjectGatewayEnabled = (): boolean => {
    return readBooleanEnv(OBJECT_GATEWAY_ENABLED_ENV, true);
};

export const isObjectGatewayReadsEnabled = (): boolean => {
    return isObjectGatewayEnabled()
        && readBooleanEnv(OBJECT_GATEWAY_READS_ENABLED_ENV, true);
};

export const isObjectGatewayWritesEnabled = (): boolean => {
    return isObjectGatewayEnabled()
        && readBooleanEnv(OBJECT_GATEWAY_WRITES_ENABLED_ENV, true);
};

export const ensureObjectGatewayAccessEnabled = (kind: ObjectGatewayAccessKind): void => {
    if (kind === 'read' && isObjectGatewayReadsEnabled()) {
        return;
    }

    if (kind === 'write' && isObjectGatewayWritesEnabled()) {
        return;
    }

    const detail = kind === 'read'
        ? `Set ${OBJECT_GATEWAY_ENABLED_ENV}=true and ${OBJECT_GATEWAY_READS_ENABLED_ENV}=true`
        : `Set ${OBJECT_GATEWAY_ENABLED_ENV}=true and ${OBJECT_GATEWAY_WRITES_ENABLED_ENV}=true`;

    throw new ApplicationError(
        'TeamCluster::ObjectGatewayDisabled',
        `Team cluster object gateway ${kind} operations are disabled. ${detail}.`,
        503
    );
};
