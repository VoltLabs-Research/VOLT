import {
    isPopulatedSecretKeyRole,
    type PopulatedRole,
    type PopulatedUser,
    type SecretKeyProps
} from '@shared/contracts/types/SecretKey';
import { Types } from 'mongoose';

export { isPopulatedSecretKeyRole };
export type { PopulatedRole, PopulatedUser, SecretKeyProps };

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
            return this.props.role._id;
        }

        return String(this.props.role);
    }

    public getRoleName(): string {
        if (isPopulatedSecretKeyRole(this.props.role)) {
            return this.props.role.name;
        }

        return 'Unknown';
    }

    public getCreatedById(): string {
        if (typeof this.props.createdBy === 'string') {
            return this.props.createdBy;
        }
        if (this.props.createdBy instanceof Types.ObjectId) {
            return this.props.createdBy.toString();
        }

        return this.props.createdBy._id;
    }
}
