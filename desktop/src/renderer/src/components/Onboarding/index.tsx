import { useEffect, useState, type FormEvent } from 'react';
import { LuServer } from 'react-icons/lu';
import { Heading, Text, TextInput, Button } from '@voltstack/bravais';
import type { RemoteProbeResult } from '@/services/RemoteProbe';
import './Onboarding.css';

interface OnboardingProps{
    onConnectRemote: (endpoint: string) => Promise<RemoteProbeResult>;
    onUseLocal: () => void;
}

type FailureReason = Extract<RemoteProbeResult, { ok: false }>['reason'];

const REASON_COPY: Record<FailureReason, string> = {
    'invalid-url': 'Enter a valid URL, e.g. https://volt.your-lab.org',
    'unreachable': "Couldn't reach that server — check the URL and that it's running.",
    'not-volt': "That endpoint didn't respond like a VOLT server.",
    'no-client-host': "This VOLT server doesn't advertise a client URL (CLIENT_HOST is unset)."
};

// Add a scheme for bare domains so the input reads as a full URL. Localhost/IP/port
// hosts are left untouched — the probe tries http for those LAN-style endpoints.
const normalizeEndpoint = (raw: string): string => {
    const value = raw.trim();
    if(!value || /^https?:\/\//i.test(value)) return value;
    if(/^(localhost|\d{1,3}(\.\d{1,3}){3})(:\d+)?(\/|$)/i.test(value)) return value;
    return `https://${value}`;
};

const Onboarding = ({ onConnectRemote, onUseLocal }: OnboardingProps) => {
    const [endpoint, setEndpoint] = useState('');
    const [recent, setRecent] = useState<string[]>([]);
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        window.volt.remote.recent().then(setRecent).catch(() => {});
    }, []);

    const connect = async (raw: string): Promise<void> => {
        const value = normalizeEndpoint(raw);
        if(!value || connecting) return;

        setEndpoint(value);
        setConnecting(true);
        setError(null);
        try{
            const result = await onConnectRemote(value);
            if(!result.ok) setError(REASON_COPY[result.reason]);
        }catch{
            setError('Could not connect to that deployment.');
        }finally{
            setConnecting(false);
        }
    };

    const submit = (event?: FormEvent) => {
        event?.preventDefault();
        void connect(endpoint);
    };

    return (
        <main className='onb'>
            <div className='onb-card'>
                <div className='onb-head'>
                    <Heading level={1} size='2xl' weight='bold'>Connect to VOLT</Heading>
                    <Text as='p' size='md' tone='secondary'>Enter the server address of your deployment.</Text>
                </div>

                <form className='onb-form' onSubmit={submit}>
                    <TextInput
                        leftIcon={<LuServer size={18} aria-hidden='true' />}
                        hasError={Boolean(error)}
                        fullWidth
                        value={endpoint}
                        spellCheck={false}
                        autoFocus
                        autoComplete='url'
                        inputMode='url'
                        autoCapitalize='none'
                        placeholder='https://volt.your-lab.org'
                        onChange={(event) => { setEndpoint(event.target.value); setError(null); }}
                    />

                    {error && <Text as='span' size='sm' className='onb-error'>{error}</Text>}

                    <Button type='submit' intent='brand' block isLoading={connecting} disabled={!endpoint.trim() || connecting}>
                        Continue
                    </Button>
                </form>

                {recent.length > 0 && (
                    <div className='onb-recent'>
                        <span className='onb-recent-label'>Recent</span>
                        <ul className='onb-recent-list'>
                            {recent.map((item) => (
                                <li key={item}>
                                    <button type='button' className='onb-recent-item' disabled={connecting} onClick={() => void connect(item)}>
                                        {item}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <button type='button' className='onb-local' onClick={onUseLocal}>
                    Prefer to run it here? <span className='onb-local-strong'>Set up Volt on this machine</span>
                </button>
            </div>
        </main>
    );
};

export default Onboarding;
