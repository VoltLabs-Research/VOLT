import crypto from 'node:crypto';

export const createEnrollmentToken = (): string => {
    return crypto.randomBytes(32).toString('hex');
};

export const hashEnrollmentToken = (enrollmentToken: string): string => {
    return crypto.createHash('sha256')
        .update(enrollmentToken)
        .digest('hex');
};
