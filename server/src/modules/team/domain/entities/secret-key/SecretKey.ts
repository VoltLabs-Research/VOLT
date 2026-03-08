export interface PopulatedRole {
    _id: string;
    name: string;
    permissions?: string[];
    toString?: () => string;
};

export interface PopulatedUser {
    _id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    toString?: () => string;
};

export interface SecretKeyProps {
    team: string;
    role: string | PopulatedRole;
    name: string;
    keyPrefix: string;
    keyHash: string;
    createdBy: string | PopulatedUser;
    isActive: boolean;
    lastUsedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
};

export const isPopulatedSecretKeyRole = (value: SecretKeyProps['role']): value is PopulatedRole => {
    return typeof value === 'object' && value !== null && '_id' in value;
};

export const isPopulatedSecretKeyUser = (value: SecretKeyProps['createdBy']): value is PopulatedUser => {
    return typeof value === 'object' && value !== null && '_id' in value;
};

export default class SecretKey {
    constructor(
        public _id: string,
        public props: SecretKeyProps
    ) {}

    public get id(): string {
        return this._id;
    }

    public getRoleId(): string {
        if (isPopulatedSecretKeyRole(this.props.role)) {
            return this.props.role._id.toString?.() ?? this.props.role._id;
        }

        return this.props.role;
    }

    public getRoleName(): string {
        if (isPopulatedSecretKeyRole(this.props.role)) {
            return this.props.role.name;
        }

        return 'Unknown';
    }

    public getCreatedById(): string {
        if (isPopulatedSecretKeyUser(this.props.createdBy)) {
            return this.props.createdBy._id.toString?.() ?? this.props.createdBy._id;
        }

        return this.props.createdBy;
    }
};
