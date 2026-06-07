import { useState, type FormEvent } from 'react';
import { LuServer } from 'react-icons/lu';
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

const Onboarding = ({ onConnectRemote, onUseLocal }: OnboardingProps) => {
    const [endpoint, setEndpoint] = useState('');
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async (event?: FormEvent) => {
        event?.preventDefault();
        const value = endpoint.trim();
        if(!value || connecting) return;

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

    return (
        <main className='onb'>
            <div className='onb-card'>
                <div className='onb-head'>
                    <h1 className='onb-title'>Connect to VOLT</h1>
                    <p className='onb-subtitle'>Enter the server address of your deployment.</p>
                </div>

                <form className='onb-form' onSubmit={submit}>
                    <div className='onb-field'>
                        <LuServer className='onb-field-icon' size={18} aria-hidden='true' />
                        <input
                            className={`onb-input ${error ? 'has-error' : ''}`}
                            value={endpoint}
                            spellCheck={false}
                            autoFocus
                            autoComplete='url'
                            inputMode='url'
                            autoCapitalize='none'
                            placeholder='https://volt.your-lab.org'
                            onChange={(event) => { setEndpoint(event.target.value); setError(null); }}
                        />
                    </div>

                    {error && <span className='onb-error'>{error}</span>}

                    <button type='submit' className='onb-continue' disabled={!endpoint.trim() || connecting}>
                        {connecting ? 'Connecting…' : 'Continue'}
                    </button>
                </form>

                <button type='button' className='onb-local' onClick={onUseLocal}>
                    Or you may prefer <span className='onb-local-strong'>setup on this machine</span>
                </button>
            </div>
        </main>
    );
};

export default Onboarding;
