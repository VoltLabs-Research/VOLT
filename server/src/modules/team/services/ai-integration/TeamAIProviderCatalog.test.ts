import '@tests/test-env';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import TeamAIProviderCatalog from '@modules/team/services/ai-integration/TeamAIProviderCatalog';
import { AIProvider, AI_PROVIDERS, AI_PROVIDER_NAMES } from '@shared/contracts/types/AIProviders';

describe('TeamAIProviderCatalog', () => {
    const catalog = new TeamAIProviderCatalog();

    describe('isSupported', () => {
        it('accepts every provider of the shared catalog', () => {
            for(const provider of AI_PROVIDERS){
                assert.equal(catalog.isSupported(provider), true);
            }
        });

        it('rejects a provider outside the catalog', () => {
            assert.equal(catalog.isSupported('llama-farm'), false);
        });

        it('rejects a provider that only differs in case', () => {
            assert.equal(catalog.isSupported('OpenAI'), false);
        });
    });

    describe('normalize', () => {
        it('lowercases and trims the provider identifier', () => {
            assert.equal(catalog.normalize('  OpenAI  '), 'openai');
        });

        it('returns the identifier of a provider already normalized', () => {
            assert.equal(catalog.normalize('anthropic'), 'anthropic');
        });

        it('returns null for an unsupported provider', () => {
            assert.equal(catalog.normalize('llama-farm'), null);
        });

        it('returns null for an empty identifier', () => {
            assert.equal(catalog.normalize('   '), null);
        });
    });

    describe('getProviderMetadata', () => {
        it('describes a supported provider with its display name', () => {
            const metadata = catalog.getProviderMetadata(AIProvider.OpenAI);

            assert.equal(metadata.id, AIProvider.OpenAI);
            assert.equal(metadata.name, AI_PROVIDER_NAMES[AIProvider.OpenAI]);
            assert.ok(metadata.description.length > 0);
        });

        it('throws for a provider outside the catalog', () => {
            assert.throws(
                () => catalog.getProviderMetadata('llama-farm' as never),
                /Unsupported provider: llama-farm/
            );
        });
    });

    describe('getAllProviderMetadata', () => {
        it('lists one entry per shared provider in declaration order', () => {
            const all = catalog.getAllProviderMetadata();

            assert.equal(all.length, AI_PROVIDERS.length);
            assert.deepEqual(all.map((metadata) => metadata.id), AI_PROVIDERS);
        });

        it('gives every entry a name and a description', () => {
            for(const metadata of catalog.getAllProviderMetadata()){
                assert.ok(metadata.name.length > 0);
                assert.ok(metadata.description.length > 0);
            }
        });
    });
});
