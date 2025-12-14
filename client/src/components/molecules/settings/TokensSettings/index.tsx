import React from 'react';
import { TbPlus } from 'react-icons/tb';
import Section from '@/components/atoms/settings/Section';
import SectionHeader from '@/components/atoms/settings/SectionHeader';
import ApiTokenList from '@/components/molecules/api-token/ApiTokenList';
import type { ApiToken } from '@/types/models/api-token';
import Container from '@/components/primitives/Container';

interface TokensSettingsProps {
    tokens: ApiToken[];
    loading: boolean;
    error: string | null;
    onCreateToken: () => void;
    onEditToken: (token: ApiToken) => void;
    onDeleteToken: (token: ApiToken) => void;
    onRegenerateToken: (token: ApiToken) => void;
}

const TokensSettings: React.FC<TokensSettingsProps> = ({
    tokens,
    loading,
    error,
    onCreateToken,
    onEditToken,
    onDeleteToken,
    onRegenerateToken
}) => {
    return (
        <Section>
            <SectionHeader
                title='API Tokens'
                description='Manage your API tokens for programmatic access'
            >
                <button
                    className='action-button primary'
                    onClick={onCreateToken}
                >
                    <TbPlus size={16} />
                    Create Token
                </button>
            </SectionHeader>

            {error && (
                <div className='error-message'>
                    {error}
                </div>
            )}

            <ApiTokenList
                tokens={tokens}
                loading={loading}
                onEdit={onEditToken}
                onDelete={onDeleteToken}
                onRegenerate={onRegenerateToken}
            />
        </Section>
    );
};

export default TokensSettings;
