import logger from '@shared/infrastructure/logger';
import { networkInterfaces } from 'node:os';
import { readPositiveIntegerEnv } from './env';

export const readRelayPortRangeValue = readPositiveIntegerEnv;

export const readRelayHostValue = (name: string, fallback: string): string => {
    const rawValue = process.env[name]?.trim();
    if (!rawValue) {
        return fallback;
    }

    return rawValue;
};

export const readOptionalRelayHostValue = (name: string): string | null => {
    const rawValue = process.env[name]?.trim();
    if (!rawValue) {
        return null;
    }

    return rawValue;
};

export const isWildcardRelayHost = (value: string): boolean => {
    return value === '0.0.0.0' || value === '::' || value === '[::]';
};

const detectNonInternalIpv4Host = (): string | null => {
    const interfaces = networkInterfaces();

    for (const addresses of Object.values(interfaces)) {
        if (!addresses) {
            continue;
        }

        for (const address of addresses) {
            if (address.family !== 'IPv4' || address.internal || isWildcardRelayHost(address.address)) {
                continue;
            }

            return address.address;
        }
    }

    return null;
};

export const resolveRelayAdvertisedHost = (bindHost: string, advertisedHostEnvName: string): string => {
    const configuredAdvertisedHost = readOptionalRelayHostValue(advertisedHostEnvName);
    if (configuredAdvertisedHost) {
        if (isWildcardRelayHost(configuredAdvertisedHost)) {
            throw new Error(`${advertisedHostEnvName} must be a reachable host, not a wildcard bind address`);
        }

        return configuredAdvertisedHost;
    }

    if (!isWildcardRelayHost(bindHost)) {
        return bindHost;
    }

    const configuredServerHostname = readOptionalRelayHostValue('SERVER_HOSTNAME');
    if (configuredServerHostname) {
        if (!isWildcardRelayHost(configuredServerHostname)) {
            return configuredServerHostname;
        }

        logger.warn(
            { bindHost, serverHostname: configuredServerHostname },
            '[RelayNetwork] Ignoring wildcard SERVER_HOSTNAME for advertised host resolution'
        );
    }

    const autoDetectedHost = detectNonInternalIpv4Host();
    if (autoDetectedHost) {
        logger.warn(
            { bindHost, advertisedHost: autoDetectedHost },
            '[RelayNetwork] Auto-detected advertised host because bind host is wildcard'
        );
        return autoDetectedHost;
    }

    logger.error(
        { bindHost, advertisedHostEnvName },
        '[RelayNetwork] Unable to determine a reachable advertised host for wildcard bind host'
    );
    throw new Error(
        `Unable to determine a reachable ${advertisedHostEnvName}. Configure ${advertisedHostEnvName} or SERVER_HOSTNAME to a non-wildcard host.`
    );
};
