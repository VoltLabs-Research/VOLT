export enum EarlyAccessSubscriptionSource {
    DiscoverTeam = 'discover_team'
}

export interface EarlyAccessSubscriptionProps {
    team: string;
    email: string;
    source: EarlyAccessSubscriptionSource;
    referrer?: string;
    lastSubmittedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

export default class EarlyAccessSubscription {
    constructor(
        public _id: string,
        public props: EarlyAccessSubscriptionProps
    ) {}

    public get id(): string {
        return this._id;
    }

    public static normalizeEmail(email: string): string {
        return email.trim().toLowerCase();
    }
}
