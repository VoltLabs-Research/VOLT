export interface SecretKeyProps {
    team: string;
    role: any;
    name: string;
    keyPrefix: string;
    keyHash: string;
    createdBy: any;
    isActive: boolean;
    lastUsedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
};

export default class SecretKey {
    constructor(
        public id: string,
        public props: SecretKeyProps
    ) {}
};
