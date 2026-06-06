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
    octokit: Octokit;

    constructor(private readonly props: RepositoryProps){
        this.octokit = new Octokit();
    }

    getId(){
        return `${this.props.owner}/${this.props.repo}`;
    }

    async fetchLatestRelease(){
        const { data } = await this.octokit.request(
            'GET /repos/{owner}/{repo}/releases/latest',
            { owner: this.props.owner, repo: this.props.repo }
        );

        if(!data.zipball_url || !data.tag_name) throw new Error('Invalid HTTP response');

        return {
            tag: data.tag_name,
            zipballUrl: data.zipball_url
        };
    }
};