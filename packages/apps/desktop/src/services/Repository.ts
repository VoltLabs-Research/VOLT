import { Octokit } from 'octokit';
import { pickLatestVoltRelease } from '@volt/contracts/modules/system/releases';

export interface RepositoryRelease{
    tag: string;
    zipballUrl: string;
};

const octokit = new Octokit(process.env.GITHUB_TOKEN ? { auth: process.env.GITHUB_TOKEN } : {});

// The newest VOLT release. GitHub's own "latest release" can be another product's (the repository
// also publishes `voltsdk-*`), so this picks among the `v*` tags.
export const fetchLatestRelease = async (owner: string, repo: string): Promise<RepositoryRelease> => {
    const id = `${owner}/${repo}`;

    try{
        const { data } = await octokit.request(
            'GET /repos/{owner}/{repo}/releases',
            {
                owner,
                repo,
                per_page: 30
            }
        );

        const latest = pickLatestVoltRelease(data);
        if(!latest) throw Object.assign(new Error('No VOLT release'), { status: 404 });
        if(!latest.zipball_url) throw new Error('Invalid HTTP response');

        return {
            tag: latest.tag_name,
            zipballUrl: latest.zipball_url
        };
    }catch(err){
        const status = (err as { status?: number })?.status;
        if(status === 404){
            throw new Error(`No published release found for ${id}. Publish a stable GitHub Release (prereleases and drafts are ignored), or run in dev mode against a local checkout.`);
        }
        if(status === 403 || status === 429){
            throw new Error(`GitHub API rate limit hit while checking ${id}. Set GITHUB_TOKEN to raise the limit, or retry later.`);
        }
        throw err;
    }
};
