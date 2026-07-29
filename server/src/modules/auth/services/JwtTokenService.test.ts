import '@tests/test-env';
import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';
import jwt from 'jsonwebtoken';
import JwtTokenService from '@modules/auth/services/JwtTokenService';

const SEVEN_DAYS_IN_SECONDS = 7 * 24 * 60 * 60;

interface DecodedToken{
    id?: unknown;
    iat: number;
    exp: number;
}

const decode = (token: string): DecodedToken => jwt.decode(token) as DecodedToken;

const lifetimeOf = (token: string): number => {
    const { iat, exp } = decode(token);
    return exp - iat;
};

describe('JwtTokenService', () => {
    const secret = process.env.SECRET_KEY as string;
    const originalExpire = process.env.JWT_EXPIRE;

    afterEach(() => {
        mock.timers.reset();
        if(originalExpire === undefined){
            delete process.env.JWT_EXPIRE;
            return;
        }
        process.env.JWT_EXPIRE = originalExpire;
    });

    it('reads back the user id from a token it signed', () => {
        const service = new JwtTokenService();

        const payload = service.verify(service.sign('user-1'));

        assert.equal(payload?.id, 'user-1');
        assert.equal(typeof payload?.iat, 'number');
        assert.equal(typeof payload?.exp, 'number');
    });

    it('rejects a token whose signature does not match the payload', () => {
        const service = new JwtTokenService();
        const [header, payload] = service.sign('user-1').split('.');

        assert.equal(service.verify(`${header}.${payload}.tampered`), null);
    });

    it('rejects a token signed with another secret', () => {
        const service = new JwtTokenService();
        const foreignToken = jwt.sign({ id: 'user-1' }, 'another-secret');

        assert.equal(service.verify(foreignToken), null);
    });

    it('rejects an expired token', () => {
        const service = new JwtTokenService();
        const expiredToken = jwt.sign({ id: 'user-1' }, secret, { expiresIn: -60 });

        assert.equal(service.verify(expiredToken), null);
    });

    it('rejects a token that carries no user id', () => {
        const service = new JwtTokenService();
        const anonymousToken = jwt.sign({ sub: 'user-1' }, secret);

        assert.equal(service.verify(anonymousToken), null);
    });

    it('rejects a token whose user id is not a string', () => {
        const service = new JwtTokenService();
        const numericToken = jwt.sign({ id: 42 }, secret);

        assert.equal(service.verify(numericToken), null);
    });

    it('rejects a token that is not a jwt at all', () => {
        const service = new JwtTokenService();

        assert.equal(service.verify('vsk_not-a-jwt'), null);
    });

    it('expires in seven days when JWT_EXPIRE is not configured', () => {
        delete process.env.JWT_EXPIRE;

        assert.equal(lifetimeOf(new JwtTokenService().sign('user-1')), SEVEN_DAYS_IN_SECONDS);
    });

    it('reads a numeric JWT_EXPIRE as a number of seconds', () => {
        process.env.JWT_EXPIRE = '3600';

        assert.equal(lifetimeOf(new JwtTokenService().sign('user-1')), 3600);
    });

    it('reads a duration JWT_EXPIRE such as 2h', () => {
        process.env.JWT_EXPIRE = '2h';

        assert.equal(lifetimeOf(new JwtTokenService().sign('user-1')), 2 * 60 * 60);
    });

    it('reads a fractional duration JWT_EXPIRE such as 1.5h', () => {
        process.env.JWT_EXPIRE = '1.5h';

        assert.equal(lifetimeOf(new JwtTokenService().sign('user-1')), 90 * 60);
    });

    it('falls back to seven days when JWT_EXPIRE is not a duration', () => {
        process.env.JWT_EXPIRE = 'whenever';

        assert.equal(lifetimeOf(new JwtTokenService().sign('user-1')), SEVEN_DAYS_IN_SECONDS);
    });

    it('falls back to seven days when JWT_EXPIRE is blank', () => {
        process.env.JWT_EXPIRE = '   ';

        assert.equal(lifetimeOf(new JwtTokenService().sign('user-1')), SEVEN_DAYS_IN_SECONDS);
    });

    it('falls back to seven days when JWT_EXPIRE has a numeric prefix but trailing text', () => {
        process.env.JWT_EXPIRE = '10 fortnights';

        assert.equal(lifetimeOf(new JwtTokenService().sign('user-1')), SEVEN_DAYS_IN_SECONDS);
    });

    it('signs the very same token twice for one user inside the same second', () => {
        mock.timers.enable({
            apis: ['Date'],
            now: 1_700_000_000_000
        });
        const service = new JwtTokenService();

        assert.equal(service.sign('user-1'), service.sign('user-1'));
    });

    it('signs different tokens for different users', () => {
        mock.timers.enable({
            apis: ['Date'],
            now: 1_700_000_000_000
        });
        const service = new JwtTokenService();

        assert.notEqual(service.sign('user-1'), service.sign('user-2'));
    });
});
