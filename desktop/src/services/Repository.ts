import { Octokit } from 'octokit';

export interface RepositoryRelease{
    tag: string;
    zipballUrl: string;
};

const octokit = new Octokit(process.env.GITHUB_TOKEN ? { auth: process.env.GITHUB_TOKEN } : {});

/**
 * The GitHub releases API is a third-party response, so its fields stay validated
 * and its status codes stay classified into actionable messages.
 */
export const fetchLatestRelease = async (owner: string, repo: string): Promise<RepositoryRelease> => {
    const id = `${owner}/${repo}`;

    try{
        const { data } = await octokit.request(
            'GET /repos/{owner}/{repo}/releases/latest',
            {
                owner,
                repo
            }
        );

        if(!data.zipball_url || !data.tag_name) throw new Error('Invalid HTTP response');

        return {
            tag: data.tag_name,
            zipballUrl: data.zipball_url
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
