import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDemoClusterStore } from '@/modules/cluster/store/use-demo-cluster-store';
import { useDemoClusterCountdown } from '@/modules/cluster/hooks/use-demo-cluster-countdown';
import { useDemoSessionActions } from '@/modules/cluster/hooks/use-demo-session-actions';
import { sileo } from 'sileo';

const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * The deleted sheet, in three literals.
 *
 * The banner is the one place in this module that is deliberately *not* themed:
 * `--accent-blue` is now the foreground, so the fill has to name `--info` — VOLT's
 * one non-HeroUI status token, declared in `index.css` for exactly this reason —
 * and the white text plus the `rgba(255,255,255,0.08)` hairline stay literal
 * because they are painted against that fill, not against the page.
 *
 * `.demo-expiration-banner-cta-button` was a full button reset, and two of its
 * declarations do not survive a literal transliteration:
 *
 *   • `background: none` is the *shorthand*, so it also resets `background-color` to
 *     transparent — which is the point, since a `<button>`'s UA default is
 *     `buttonface`. `bg-none` would only set `background-image`, so it is
 *     `bg-transparent`.
 *   • `font: inherit` pulled the family and size down from the banner. `font-sans`
 *     plus `text-sm` name exactly what it inherited (the body stack, and the
 *     banner's own 0.875rem) rather than leaving the button on the UA's Arial at
 *     13.33px.
 *
 * The two `:disabled` rules become `disabled:` variants, which still apply because
 * this is a real `<button>` carrying the native attribute.
 */
const BANNER_CLASS = 'flex flex-row items-center justify-center gap-3 bg-info px-4 py-2 text-sm text-white border-b border-white/8';

const BANNER_CTA_CLASS = 'text-white font-semibold underline underline-offset-2 hover:opacity-90';

const BANNER_CTA_BUTTON_CLASS = 'border-0 bg-transparent p-0 font-sans text-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-70';

const DemoExpirationBanner = () => {
    const navigate = useNavigate();
    const isDemo = useDemoClusterStore((state) => state.isDemo);
    const expiresAt = useDemoClusterStore((state) => state.expiresAt);
    const clear = useDemoClusterStore((state) => state.clear);
    const { minutes, seconds, expired } = useDemoClusterCountdown(expiresAt);
    const { endSession, isEndingSession } = useDemoSessionActions();
    const expiredHandled = useRef(false);

    useEffect(() => {
        if (!isDemo || !expiresAt || !expired || expiredHandled.current) return;
        expiredHandled.current = true;
        sileo.info({
            title: 'Demo session expired',
            description: 'Your temporary environment has been removed.'
        });
        clear();
        navigate('/onboarding/cluster/setup?reason=demo-expired', { replace: true });
    }, [isDemo, expiresAt, expired, clear, navigate]);

    if (!isDemo || !expiresAt) return null;

    return (
        <div className={BANNER_CLASS}
            role='status'
            aria-live='polite'
        >
            <span className='text-white font-medium'>
                You&apos;re using a temporal container that expires in {pad(minutes)}:{pad(seconds)}
            </span>
            <Link
                to='/onboarding/cluster/setup'
                className={BANNER_CTA_CLASS}
            >
                Connect a Cluster
                <span aria-hidden='true'>&nbsp;→</span>
            </Link>
            <button
                type='button'
                className={`${BANNER_CTA_CLASS} ${BANNER_CTA_BUTTON_CLASS}`}
                onClick={() => {
                    void endSession();
                }}
                disabled={isEndingSession}
            >
                {isEndingSession ? 'Ending session...' : 'End session'}
            </button>
        </div>
    );
};

export default DemoExpirationBanner;
