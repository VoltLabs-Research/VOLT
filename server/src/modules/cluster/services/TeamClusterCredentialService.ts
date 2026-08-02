import crypto from 'node:crypto';

export const secureCompare = (left: string, right: string): boolean => {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);

    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const createEnrollmentToken = (): string => {
    return crypto.randomBytes(32).toString('hex');
};

export const hashEnrollmentToken = (enrollmentToken: string): string => {
    return crypto.createHash('sha256')
        .update(enrollmentToken)
        .digest('hex');
};
