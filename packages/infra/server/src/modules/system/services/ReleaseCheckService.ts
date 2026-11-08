import logger from '@shared/logger';
import { normalizeVersion, pickLatestVoltRelease, VOLT_RELEASES_API } from '@volt/contracts/modules/system/releases';
import type { GithubReleaseSummary } from '@volt/contracts/modules/system/releases';
import type { VoltRelease } from '@volt/contracts/modules/system/domain';

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const FAILED_CHECK_RETRY_MS = 10 * 60 * 1000;

// The newest VOLT release on GitHub, checked at most once an hour. A failed check keeps the last
// answer, so a rate limit or an offline host never makes an update disappear from the app.
class ReleaseCheckService{
    #latest: VoltRelease | null = null;
    #checkedAt = 0;
    #nextCheckAt = 0;
    #inFlight: Promise<VoltRelease | null> | null = null;

    async latest(): Promise<VoltRelease | null>{
        if(Date.now() < this.#nextCheckAt) return this.#latest;
        this.#inFlight ??= this.#check().finally(() => {
            this.#inFlight = null;
        });
        return this.#inFlight;
    }

    async #check(): Promise<VoltRelease | null>{
        try{
            const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
            if(process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

            const response = await fetch(VOLT_RELEASES_API, {
                headers,
                signal: AbortSignal.timeout(10_000)
            });
            if(!response.ok) throw new Error(`GitHub answered ${response.status}`);

            const release = pickLatestVoltRelease(await response.json() as GithubReleaseSummary[]);
            this.#latest = release ? {
                version: normalizeVersion(release.tag_name),
                url: release.html_url
            } : null;
            this.#checkedAt = Date.now();
            this.#nextCheckAt = this.#checkedAt + CHECK_INTERVAL_MS;
        }catch(error){
            logger.warn(`[updates] could not check for a newer VOLT release: ${error instanceof Error ? error.message : String(error)}`);
            this.#nextCheckAt = Date.now() + FAILED_CHECK_RETRY_MS;
        }
        return this.#latest;
    }
}

export default new ReleaseCheckService();
