import { useEffect, useState, type FormEvent } from 'react';
import { Server } from 'lucide-react';
import { Button, FieldError, InputGroup, Spinner, TextField } from '@heroui/react';
import type { RemoteProbeResult } from '@/services/RemoteProbe';

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
        <main className='absolute inset-0 z-10 flex items-center justify-center p-[clamp(24px,5vw,64px)]'>
            <div className='flex w-full max-w-[420px] flex-col gap-6'>
                <div className='flex flex-col gap-1.5'>
                    <h1 className='text-2xl font-semibold text-foreground'>Connect to VOLT</h1>
                    <p className='text-sm text-muted'>Enter the server address of your deployment.</p>
                </div>
                <form className='flex flex-col gap-2' onSubmit={submit}>
                    <TextField
                        aria-label='Server address'
                        value={endpoint}
                        onChange={(value) => { setEndpoint(value); setError(null); }}
                        isInvalid={Boolean(error)}
                        fullWidth
                    >
                        <InputGroup>
                            <InputGroup.Prefix><Server size={18} aria-hidden='true' /></InputGroup.Prefix>
                            <InputGroup.Input
                                spellCheck={false}
                                autoFocus
                                autoComplete='url'
                                inputMode='url'
                                autoCapitalize='none'
                                placeholder='https://volt.your-lab.org'
                            />
                        </InputGroup>
                        {error && <FieldError>{error}</FieldError>}
                    </TextField>
                    <Button type='submit' variant='primary' fullWidth isPending={connecting} isDisabled={!endpoint.trim()}>
                        {connecting && <Spinner size='sm' color='current' />}
                        Continue
                    </Button>
                </form>

                {recent.length > 0 && (
                    <div className='flex flex-col gap-2'>
                        <span className='text-[11px] font-semibold uppercase tracking-[0.04em] text-muted/75'>Recent</span>
                        <ul className='flex flex-col gap-1.5'>
                            {recent.map((item) => (
                                <li key={item}>
                                    <button
                                        type='button'
                                        className='w-full cursor-pointer overflow-hidden truncate rounded-lg border border-border bg-surface-secondary px-3 py-2.5 text-left text-[13px] text-muted transition-colors duration-[120ms] ease-out-fluid hover:bg-default hover:text-foreground disabled:cursor-default disabled:opacity-50'
                                        disabled={connecting}
                                        onClick={() => void connect(item)}
                                    >
                                        {item}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <button type='button' className='group/local self-center cursor-pointer text-[0.8125rem] text-muted/75' onClick={onUseLocal}>
                    Prefer to run it here? <span className='text-muted transition-colors duration-150 ease-out-fluid group-hover/local:text-foreground group-hover/local:underline group-hover/local:underline-offset-2'>Set up Volt on this machine</span>
                </button>
            </div>
        </main>
    );
};

export default Onboarding;
