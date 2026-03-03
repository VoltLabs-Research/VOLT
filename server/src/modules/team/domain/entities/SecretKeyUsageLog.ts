export interface SecretKeyUsageLogProps {
    secretKey: string;
    team: string;
    method: string;
    path: string;
    statusCode: number;
    responseTime: number;
    ip: string;
    userAgent: string;
    createdAt: Date;
};

export default class SecretKeyUsageLog {
    constructor(
        public id: string,
        public props: SecretKeyUsageLogProps
    ) {}
};
