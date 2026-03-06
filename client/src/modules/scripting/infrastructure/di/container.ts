import { container } from 'tsyringe';
import type IScriptingRepository from '@/modules/scripting/domain/port/IScriptingRepository';
import ScriptingRepository from '@/modules/scripting/infrastructure/repositories/ScriptingRepository';
import { SCRIPTING_TOKENS } from './tokens';

let initialized = false;

export const ensureScriptingDI = (): void => {
    if (initialized) return;

    container.register<IScriptingRepository>(
        SCRIPTING_TOKENS.ScriptingRepository,
        ScriptingRepository
    );

    initialized = true;
};
