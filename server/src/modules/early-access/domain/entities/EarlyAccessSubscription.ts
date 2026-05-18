export enum EarlyAccessSubscriptionSource {
    DiscoverTeam = 'discover_team'
}

export interface EarlyAccessSubscriptionRef {
    _id?: string;
    toString?: () => string;
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

    public getTeamId(): string {
        return EarlyAccessSubscription.getRefId(this.props.team);
    }

    public static normalizeEmail(email: string): string {
        return email.trim().toLowerCase();
    }

    private static getRefId(value: string | EarlyAccessSubscriptionRef): string {
        if (typeof value === 'string') {
            return value;
        }

        if (value._id) {
            return value._id;
        }

        return value.toString?.() ?? '';
    }
}
