import { Octokit } from 'octokit';

export interface ReleaseCheckerProps{
    owner: string;
    repo: string;
}

export interface ReleaseAsset{
    name: string;
    size: number;
    browser_download_url: string;
}

export default class ReleaseChecker{
    props: ReleaseCheckerProps;
    octokit: Octokit;

    constructor(props: ReleaseCheckerProps){
        this.props = props;
        this.octokit = new Octokit();
    }

    async discover(): Promise<ReleaseAsset[]>{
        const { data } = await this.octokit.request(
            'GET /repos/{owner}/{repo}/releases/latest',
            { owner: this.props.owner, repo: this.props.repo }
        );

        return data.assets;
    }
}