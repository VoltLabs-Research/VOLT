import '@tests/test-env';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { DataSource } from 'typeorm';
import { createHarness, destroyHarness } from '@tests/harness';
import ApplicationError from '@shared/application/errors/ApplicationError';
import Team from '@modules/team/models/Team';
import TeamAIIntegration from '@modules/team/models/TeamAIIntegration';
import TeamAIIntegrationService from '@modules/team/services/TeamAIIntegrationService';
import User from '@modules/auth/models/User';
import { decrypt } from '@shared/infrastructure/utilities/crypto';
import { AIProvider, AI_PROVIDERS } from '@shared/contracts/types/AIProviders';

interface Fixture{
    owner: User;
    team: Team;
    otherTeam: Team;
}

describe('TeamAIIntegrationService', () => {
    let dataSource: DataSource;
    const service = new TeamAIIntegrationService();

    before(async () => {
        dataSource = await createHarness([Team, TeamAIIntegration, User]);
    });

    after(async () => {
        await destroyHarness(dataSource);
    });

    beforeEach(async () => {
        await dataSource.synchronize(true);
    });

    const createFixture = async (): Promise<Fixture> => {
        const owner = await User.create({
            email: 'owner@volt.test',
            firstName: 'ada'
        }).save();
        const team = await Team.create({
            name: 'Team One',
            owner: owner.id
        }).save();
        const otherTeam = await Team.create({
            name: 'Team Two',
            owner: owner.id
        }).save();

        return {
            owner,
            team,
            otherTeam
        };
    };

    describe('createByProvider', () => {
        it('persists the integration with an encrypted api key', async () => {
            const fixture = await createFixture();

            const result = await service.createByProvider(fixture.team.id, fixture.owner.id, 'openai', {
                apiKey: 'sk-live-secret',
                defaultModel: 'gpt-5',
                enabledModels: [{
                    id: 'gpt-5',
                    name: 'GPT 5'
                }]
            });

            assert.equal(result.integration.provider, 'openai');
            assert.equal(result.integration.providerName, 'OpenAI');
            assert.equal(result.integration.hasApiKey, true);
            const stored = await TeamAIIntegration.findOneByOrFail({
                team: fixture.team.id,
                provider: AIProvider.OpenAI
            });
            assert.notEqual(stored.encryptedApiKey, 'sk-live-secret');
            assert.equal(await decrypt(stored.encryptedApiKey), 'sk-live-secret');
        });

        it('keeps the encrypted api key out of the wire payload', async () => {
            const fixture = await createFixture();

            const result = await service.createByProvider(fixture.team.id, fixture.owner.id, 'openai', {
                apiKey: 'sk-live-secret',
                defaultModel: 'gpt-5'
            });

            assert.equal('encryptedApiKey' in result.integration, false);
            const stored = await TeamAIIntegration.findOneByOrFail({ team: fixture.team.id });
            assert.equal('encryptedApiKey' in stored.toJSON(), false);
            assert.equal(stored.toJSON()._id, stored.id);
        });

        it('normalizes the provider before storing it', async () => {
            const fixture = await createFixture();

            const result = await service.createByProvider(fixture.team.id, fixture.owner.id, '  ANTHROPIC ', {
                apiKey: 'sk-live-secret',
                defaultModel: 'claude'
            });

            assert.equal(result.integration.provider, 'anthropic');
            assert.equal(await TeamAIIntegration.countBy({ provider: AIProvider.Anthropic }), 1);
        });

        it('round trips the enabled models through the simple-json column', async () => {
            const fixture = await createFixture();
            const enabledModels = [
                {
                    id: 'gpt-5',
                    name: 'GPT 5'
                },
                {
                    id: 'gpt-5-mini',
                    name: 'GPT 5 Mini'
                }
            ];

            await service.createByProvider(fixture.team.id, fixture.owner.id, 'openai', {
                apiKey: 'sk-live-secret',
                defaultModel: 'gpt-5',
                enabledModels
            });

            assert.deepEqual((await TeamAIIntegration.findOneByOrFail({ team: fixture.team.id })).enabledModels, enabledModels);
        });

        it('round trips the metadata through the simple-json column', async () => {
            const fixture = await createFixture();
            const metadata = {
                baseUrl: 'https://proxy.volt.test',
                limits: { tokens: 1000 }
            };

            await service.createByProvider(fixture.team.id, fixture.owner.id, 'openai', {
                apiKey: 'sk-live-secret',
                defaultModel: 'gpt-5',
                metadata
            });

            assert.deepEqual((await TeamAIIntegration.findOneByOrFail({ team: fixture.team.id })).metadata, metadata);
        });

        it('defaults the metadata and the enabled models to empty containers', async () => {
            const fixture = await createFixture();

            await service.createByProvider(fixture.team.id, fixture.owner.id, 'openai', {
                apiKey: 'sk-live-secret',
                defaultModel: 'gpt-5'
            });

            const stored = await TeamAIIntegration.findOneByOrFail({ team: fixture.team.id });
            assert.deepEqual(stored.metadata, {});
            assert.deepEqual(stored.enabledModels, []);
        });

        it('deduplicates the enabled models by identifier', async () => {
            const fixture = await createFixture();

            await service.createByProvider(fixture.team.id, fixture.owner.id, 'openai', {
                apiKey: 'sk-live-secret',
                defaultModel: 'gpt-5',
                enabledModels: [
                    {
                        id: 'gpt-5',
                        name: 'GPT 5'
                    },
                    {
                        id: 'gpt-5',
                        name: 'GPT 5 Duplicate'
                    }
                ]
            });

            assert.deepEqual((await TeamAIIntegration.findOneByOrFail({ team: fixture.team.id })).enabledModels, [{
                id: 'gpt-5',
                name: 'GPT 5 Duplicate'
            }]);
        });

        it('drops the enabled models with a blank identifier or name', async () => {
            const fixture = await createFixture();

            await service.createByProvider(fixture.team.id, fixture.owner.id, 'openai', {
                apiKey: 'sk-live-secret',
                defaultModel: 'gpt-5',
                enabledModels: [
                    {
                        id: '  ',
                        name: 'Blank id'
                    },
                    {
                        id: 'gpt-5',
                        name: '   '
                    },
                    {
                        id: ' gpt-5-mini ',
                        name: ' GPT 5 Mini '
                    }
                ]
            });

            assert.deepEqual((await TeamAIIntegration.findOneByOrFail({ team: fixture.team.id })).enabledModels, [{
                id: 'gpt-5-mini',
                name: 'GPT 5 Mini'
            }]);
        });

        it('accepts ollama without an api key', async () => {
            const fixture = await createFixture();

            const result = await service.createByProvider(fixture.team.id, fixture.owner.id, 'ollama', { defaultModel: 'llama3' });

            assert.equal(result.integration.provider, 'ollama');
            const stored = await TeamAIIntegration.findOneByOrFail({ team: fixture.team.id });
            assert.equal(await decrypt(stored.encryptedApiKey), 'ollama-local');
        });

        it('rejects an unsupported provider', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.createByProvider(fixture.team.id, fixture.owner.id, 'llama-farm', {
                    apiKey: 'x',
                    defaultModel: 'y'
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamAIIntegration::Provider::Unsupported');
                    assert.equal(error.message, 'Provider is not supported');
                    assert.equal(error.statusCode, 400);
                    return true;
                }
            );
        });

        it('rejects a hosted provider without an api key', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.createByProvider(fixture.team.id, fixture.owner.id, 'openai', {
                    apiKey: '   ',
                    defaultModel: 'gpt-5'
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamAIIntegration::ApiKey::Required');
                    assert.equal(error.message, 'API key is required for new integration');
                    return true;
                }
            );
        });

        it('rejects an integration without a default model', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.createByProvider(fixture.team.id, fixture.owner.id, 'openai', {
                    apiKey: 'sk-live-secret',
                    defaultModel: '  '
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamAIIntegration::Model::Unsupported');
                    assert.equal(error.message, 'Default model is required');
                    return true;
                }
            );
        });

        it('rejects a second integration for the same provider in the same team', async () => {
            const fixture = await createFixture();
            await service.createByProvider(fixture.team.id, fixture.owner.id, 'openai', {
                apiKey: 'sk-live-secret',
                defaultModel: 'gpt-5'
            });

            await assert.rejects(
                () => service.createByProvider(fixture.team.id, fixture.owner.id, 'openai', {
                    apiKey: 'sk-live-other',
                    defaultModel: 'gpt-5'
                }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamAIIntegration::AlreadyExists');
                    assert.equal(error.message, 'An integration for this provider already exists in this team');
                    return true;
                }
            );
        });

        it('allows the same provider in two different teams', async () => {
            const fixture = await createFixture();
            await service.createByProvider(fixture.team.id, fixture.owner.id, 'openai', {
                apiKey: 'sk-live-secret',
                defaultModel: 'gpt-5'
            });

            await service.createByProvider(fixture.otherTeam.id, fixture.owner.id, 'openai', {
                apiKey: 'sk-live-other',
                defaultModel: 'gpt-5'
            });

            assert.equal(await TeamAIIntegration.countBy({ provider: AIProvider.OpenAI }), 2);
        });
    });

    describe('listByTeamId', () => {
        it('returns the integrations of the team and the provider catalog', async () => {
            const fixture = await createFixture();
            await service.createByProvider(fixture.team.id, fixture.owner.id, 'openai', {
                apiKey: 'sk-live-secret',
                defaultModel: 'gpt-5'
            });

            const result = await service.listByTeamId(fixture.team.id);

            assert.equal(result.teamId, fixture.team.id);
            assert.deepEqual(result.integrations.map((integration) => integration.provider), ['openai']);
            assert.equal(result.providers.length, AI_PROVIDERS.length);
        });

        it('excludes the integrations of the other teams', async () => {
            const fixture = await createFixture();
            await service.createByProvider(fixture.otherTeam.id, fixture.owner.id, 'openai', {
                apiKey: 'sk-live-secret',
                defaultModel: 'gpt-5'
            });

            const result = await service.listByTeamId(fixture.team.id);

            assert.deepEqual(result.integrations, []);
        });

        it('reports the provider catalog even for a team without integrations', async () => {
            const fixture = await createFixture();

            const result = await service.listByTeamId(fixture.team.id);

            assert.deepEqual(result.integrations, []);
            assert.equal(result.providers.length, AI_PROVIDERS.length);
        });
    });

    describe('listModels', () => {
        it('flattens the enabled models of the enabled integrations', async () => {
            const fixture = await createFixture();
            await service.createByProvider(fixture.team.id, fixture.owner.id, 'openai', {
                apiKey: 'sk-live-secret',
                defaultModel: 'gpt-5',
                enabledModels: [
                    {
                        id: 'gpt-5',
                        name: 'GPT 5'
                    },
                    {
                        id: 'gpt-5-mini',
                        name: 'GPT 5 Mini'
                    }
                ]
            });

            const result = await service.listModels(fixture.team.id);

            assert.deepEqual(result.models.map((model) => model.id), ['gpt-5', 'gpt-5-mini']);
            assert.deepEqual(result.models.map((model) => model.isDefault), [true, false]);
            assert.deepEqual(result.providers.map((provider) => provider.provider), ['openai']);
            assert.equal(result.providers[0].providerName, 'OpenAI');
        });

        it('skips the disabled integrations', async () => {
            const fixture = await createFixture();
            await service.createByProvider(fixture.team.id, fixture.owner.id, 'openai', {
                apiKey: 'sk-live-secret',
                defaultModel: 'gpt-5',
                isEnabled: false,
                enabledModels: [{
                    id: 'gpt-5',
                    name: 'GPT 5'
                }]
            });

            const result = await service.listModels(fixture.team.id);

            assert.deepEqual(result.providers, []);
            assert.deepEqual(result.models, []);
        });
    });

    describe('updateByProvider', () => {
        it('replaces the api key when a new one is supplied', async () => {
            const fixture = await createFixture();
            await service.createByProvider(fixture.team.id, fixture.owner.id, 'openai', {
                apiKey: 'sk-live-first',
                defaultModel: 'gpt-5'
            });

            await service.updateByProvider(fixture.team.id, 'openai', { apiKey: 'sk-live-second' });

            const stored = await TeamAIIntegration.findOneByOrFail({ team: fixture.team.id });
            assert.equal(await decrypt(stored.encryptedApiKey), 'sk-live-second');
        });

        it('keeps the stored api key when none is supplied', async () => {
            const fixture = await createFixture();
            await service.createByProvider(fixture.team.id, fixture.owner.id, 'openai', {
                apiKey: 'sk-live-first',
                defaultModel: 'gpt-5'
            });
            const before = await TeamAIIntegration.findOneByOrFail({ team: fixture.team.id });

            await service.updateByProvider(fixture.team.id, 'openai', { defaultModel: 'gpt-5-mini' });

            const after = await TeamAIIntegration.findOneByOrFail({ team: fixture.team.id });
            assert.equal(after.encryptedApiKey, before.encryptedApiKey);
            assert.equal(after.defaultModel, 'gpt-5-mini');
        });

        it('keeps the stored enabled models and metadata when none are supplied', async () => {
            const fixture = await createFixture();
            await service.createByProvider(fixture.team.id, fixture.owner.id, 'openai', {
                apiKey: 'sk-live-first',
                defaultModel: 'gpt-5',
                enabledModels: [{
                    id: 'gpt-5',
                    name: 'GPT 5'
                }],
                metadata: { baseUrl: 'https://proxy.volt.test' }
            });

            await service.updateByProvider(fixture.team.id, 'openai', { isEnabled: false });

            const stored = await TeamAIIntegration.findOneByOrFail({ team: fixture.team.id });
            assert.deepEqual(stored.enabledModels, [{
                id: 'gpt-5',
                name: 'GPT 5'
            }]);
            assert.deepEqual(stored.metadata, { baseUrl: 'https://proxy.volt.test' });
            assert.equal(stored.isEnabled, false);
        });

        it('replaces the enabled models when a new list is supplied', async () => {
            const fixture = await createFixture();
            await service.createByProvider(fixture.team.id, fixture.owner.id, 'openai', {
                apiKey: 'sk-live-first',
                defaultModel: 'gpt-5',
                enabledModels: [{
                    id: 'gpt-5',
                    name: 'GPT 5'
                }]
            });

            await service.updateByProvider(fixture.team.id, 'openai', { enabledModels: [] });

            assert.deepEqual((await TeamAIIntegration.findOneByOrFail({ team: fixture.team.id })).enabledModels, []);
        });

        it('rejects an unsupported provider', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.updateByProvider(fixture.team.id, 'llama-farm', {}),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamAIIntegration::Provider::Unsupported');
                    return true;
                }
            );
        });

        it('rejects a provider without an integration in the team', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.updateByProvider(fixture.team.id, 'openai', { apiKey: 'sk-live-secret' }),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamAIIntegration::NotFound');
                    assert.equal(error.message, 'AI integration not found for this provider');
                    assert.equal(error.statusCode, 404);
                    return true;
                }
            );
        });
    });

    describe('deleteByProvider', () => {
        it('removes the integration of the requested provider', async () => {
            const fixture = await createFixture();
            await service.createByProvider(fixture.team.id, fixture.owner.id, 'openai', {
                apiKey: 'sk-live-secret',
                defaultModel: 'gpt-5'
            });

            await service.deleteByProvider(fixture.team.id, 'openai');

            assert.equal(await TeamAIIntegration.countBy({ team: fixture.team.id }), 0);
        });

        it('keeps the integration of the same provider in the other teams', async () => {
            const fixture = await createFixture();
            await service.createByProvider(fixture.team.id, fixture.owner.id, 'openai', {
                apiKey: 'sk-live-secret',
                defaultModel: 'gpt-5'
            });
            await service.createByProvider(fixture.otherTeam.id, fixture.owner.id, 'openai', {
                apiKey: 'sk-live-other',
                defaultModel: 'gpt-5'
            });

            await service.deleteByProvider(fixture.team.id, 'openai');

            assert.equal(await TeamAIIntegration.countBy({ team: fixture.otherTeam.id }), 1);
        });

        it('rejects an unsupported provider', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.deleteByProvider(fixture.team.id, 'llama-farm'),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamAIIntegration::Provider::Unsupported');
                    return true;
                }
            );
        });

        it('rejects a provider without an integration in the team', async () => {
            const fixture = await createFixture();

            await assert.rejects(
                () => service.deleteByProvider(fixture.team.id, 'openai'),
                (error: unknown) => {
                    assert.ok(error instanceof ApplicationError);
                    assert.equal(error.code, 'TeamAIIntegration::NotFound');
                    assert.equal(error.message, 'Team AI integration not found');
                    return true;
                }
            );
        });
    });
});
