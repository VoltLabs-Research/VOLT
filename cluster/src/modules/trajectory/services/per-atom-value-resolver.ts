import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { toBytes, type InboundChunk } from '@shared/contracts/channel/binary-envelope';
import type { ParsedTrajectory, TrajectoryParser } from '@modules/trajectory/services/parsing/TrajectoryParser';
import type { ModifierScalarValues, PluginPropertyStore } from '@modules/plugin/services/properties/PluginPropertyStore';

interface PerAtomValueSource {
    trajectoryId: string;
    timestep: number;
    ownerClusterId: string;
    property: string;
    analysisId?: string;
    exposureId?: string;
    /* Reaches us over the reverse channel, so it is not necessarily a typed array yet. */
    externalValues?: InboundChunk;
}

type ResolvedPerAtomValues =
    | { parsed: ParsedTrajectory; valueType: 'number'; values: Float32Array }
    | { parsed: ParsedTrajectory; valueType: 'string'; values: Array<string | null> };

const decodeExternalFloat32Values = (externalValues: InboundChunk): Float32Array => {
    if (externalValues instanceof Float32Array) {
        return externalValues;
    }

    const bytes = toBytes(externalValues);

    if ((bytes.byteOffset % Float32Array.BYTES_PER_ELEMENT) === 0) {
        return new Float32Array(
            bytes.buffer,
            bytes.byteOffset,
            bytes.byteLength / Float32Array.BYTES_PER_ELEMENT
        );
    }

    return new Float32Array(new Uint8Array(bytes).buffer);
};

const remapExternalStringValues = (
    parsed: ParsedTrajectory,
    externalValues: Array<string | null>
): Array<string | null> => {
    if (!parsed.ids) {
        throw new Error('Trajectory atom ids are required for external values');
    }

    const values = Array<string | null>(parsed.ids.length).fill(null);
    for (let index = 0; index < parsed.ids.length; index++) {
        values[index] = externalValues[parsed.ids[index]] ?? null;
    }
    return values;
};

const propertyNotFound = (input: PerAtomValueSource): ApplicationError => ApplicationError.unprocessableEntity(
    ErrorCodes.FILTER_PROPERTY_NOT_FOUND,
    `Property "${input.property}" is not present in the trajectory at timestep ${input.timestep}.`
);

const resolveExternalValues = async (
    pluginPropertyStore: PluginPropertyStore,
    input: PerAtomValueSource
): Promise<ModifierScalarValues | undefined> => {
    if (input.externalValues) {
        return {
            type: 'number',
            values: decodeExternalFloat32Values(input.externalValues)
        };
    }

    if (!input.analysisId || !input.exposureId) {
        return undefined;
    }

    const modifierValues = await pluginPropertyStore.getModifierScalarValues({
        trajectoryId: input.trajectoryId,
        analysisId: input.analysisId,
        exposureId: input.exposureId,
        timestep: input.timestep,
        property: input.property,
        ownerClusterId: input.ownerClusterId
    });

    if (!modifierValues) {
        throw ApplicationError.unprocessableEntity(
            ErrorCodes.MODIFIER_VALUES_UNAVAILABLE,
            `Per-atom property "${input.property}" is not available for exposure "${input.exposureId}" ` +
            `on analysis "${input.analysisId}" at timestep ${input.timestep}.`
        );
    }

    return modifierValues;
};

export const resolvePerAtomValues = async (
    trajectoryParser: TrajectoryParser,
    pluginPropertyStore: PluginPropertyStore,
    input: PerAtomValueSource
): Promise<ResolvedPerAtomValues> => {
    const parsed = await trajectoryParser.readFrame(input);
    const externalValues = await resolveExternalValues(pluginPropertyStore, input);

    if (externalValues?.type === 'string') {
        const values = remapExternalStringValues(parsed, externalValues.values);
        if (!values.some((value) => value !== null)) {
            throw propertyNotFound(input);
        }

        return {
            parsed,
            values,
            valueType: 'string'
        };
    }

    const values = externalValues
        ? trajectoryParser.remapExternalValues(parsed, externalValues.values)
        : trajectoryParser.getPropertyValues(parsed, input.property);
    if (values.length === 0) {
        throw propertyNotFound(input);
    }

    return {
        parsed,
        values,
        valueType: 'number'
    };
};
