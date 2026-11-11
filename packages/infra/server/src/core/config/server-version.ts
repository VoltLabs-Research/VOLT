import { normalizeVersion } from '@volt/contracts/modules/system/releases';

// The release this server runs. deploy.sh passes it as VOLT_VERSION; a development build has none,
// and then nothing compares it against newer releases.
export const getServerVersion = (): string | null => {
    const raw = process.env.VOLT_VERSION?.trim();
    return raw ? normalizeVersion(raw) : null;
};
