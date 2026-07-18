import { Octokit } from 'octokit';

export interface RepositoryProps{
    owner: string;
    repo: string;
};

export interface RepositoryRelease{
    tag: string;
    zipballUrl: string;
};

export default class Repository{
    
    
    #octokit = new Octokit(process.env.GITHUB_TOKEN ? { auth: process.env.GITHUB_TOKEN } : {});

    constructor(private readonly props: RepositoryProps){}

    getId(){
        return `${this.props.owner}/${this.props.repo}`;
    }

    async fetchLatestRelease(){
        try{
            const { data } = await this.#octokit.request(
                'GET /repos/{owner}/{repo}/releases/latest',
                { owner: this.props.owner, repo: this.props.repo }
            );

            if(!data.zipball_url || !data.tag_name) throw new Error('Invalid HTTP response');

            return {
                tag: data.tag_name,
                zipballUrl: data.zipball_url
            };
        }catch(err){
            
            
            
            const status = (err as { status?: number })?.status;
            if(status === 404){
                throw new Error(`No published release found for ${this.getId()}. Publish a stable GitHub Release (prereleases and drafts are ignored), or run in dev mode against a local checkout.`);
            }
            if(status === 403 || status === 429){
                throw new Error(`GitHub API rate limit hit while checking ${this.getId()}. Set GITHUB_TOKEN to raise the limit, or retry later.`);
            }
            throw err;
        }
    }
};