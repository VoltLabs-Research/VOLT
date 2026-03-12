import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { inject, injectable } from 'tsyringe';

import type { ITrajectoryReader } from '@modules/trajectory/domain/port/trajectory/ITrajectoryReader';
import type { AtomPageEntry, AtomPageResult } from '@modules/trajectory/domain/contracts/trajectory';
import type { ITrajectoryDumpStorageService } from '@modules/trajectory/domain/port/trajectory/ITrajectoryDumpStorageService';
import type TrajectoryNativeDaemonService from '@modules/trajectory/infrastructure/services/native/TrajectoryNativeDaemonService';

interface AtomColumnIndexes {
    id: number;
    type: number;
    x: number;
    y: number;
    z: number;
};

@injectable()
export default class TrajectoryReader implements ITrajectoryReader {
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryNativeDaemonService)
        private readonly trajectoryNativeDaemonService: TrajectoryNativeDaemonService,

        @inject(TRAJECTORY_TOKENS.TrajectoryDumpStorageService)
        private readonly trajectoryDumpStorageService: ITrajectoryDumpStorageService
    ) {}

    async readPage(
        teamClusterId: string | undefined,
        trajectoryId: string,
        timestep: string | number,
        page: number,
        limit: number
    ): Promise<AtomPageResult> {
        if (!teamClusterId) {
            return this.readLocalPage(trajectoryId, timestep, page, limit);
        }

        return this.trajectoryNativeDaemonService.getAtomsPage({
            teamClusterId,
            trajectoryId,
            timestep,
            objectKey: this.getDumpObjectKey(trajectoryId, timestep),
            page,
            limit
        });
    }

    private async readLocalPage(
        trajectoryId: string,
        timestep: string | number,
        page: number,
        limit: number
    ): Promise<AtomPageResult> {
        const dumpPath = await this.trajectoryDumpStorageService.getDump(trajectoryId, String(timestep));
        if (!dumpPath) {
            throw ApplicationError.notFound(
                ErrorCodes.TRAJECTORY_DUMP_NOT_FOUND,
                `Dump not found for trajectory ${trajectoryId} at timestep ${timestep}`
            );
        }

        const atoms: AtomPageEntry[] = [];
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        let totalAtoms = 0;
        let atomIndex = 0;
        let expectsTotalAtoms = false;
        let columns: AtomColumnIndexes | null = null;

        const stream = createReadStream(dumpPath, {
            encoding: 'utf8'
        });
        const reader = createInterface({
            input: stream,
            crlfDelay: Infinity
        });

        try {
            for await (const line of reader) {
                const trimmedLine = line.trim();

                if (!trimmedLine) {
                    continue;
                }

                if (expectsTotalAtoms) {
                    totalAtoms = Number(trimmedLine);
                    expectsTotalAtoms = false;
                    continue;
                }

                if (trimmedLine.startsWith('ITEM: NUMBER OF ATOMS')) {
                    expectsTotalAtoms = true;
                    continue;
                }

                if (trimmedLine.startsWith('ITEM: ATOMS')) {
                    columns = this.getAtomColumnIndexes(trimmedLine);
                    continue;
                }

                if (!columns || trimmedLine.startsWith('ITEM:')) {
                    continue;
                }

                if (atomIndex >= endIndex) {
                    break;
                }

                if (atomIndex >= startIndex) {
                    atoms.push(this.parseAtomLine(trimmedLine, columns));
                }

                atomIndex += 1;
            }
        } catch (error: unknown) {
            if (error instanceof ApplicationError) {
                throw error;
            }

            throw new ApplicationError(
                ErrorCodes.TRAJECTORY_DUMP_PARSE_FAILED,
                'Failed to parse trajectory dump atoms',
                500
            );
        } finally {
            reader.close();
            stream.destroy();
        }

        if (!columns) {
            throw new ApplicationError(
                ErrorCodes.TRAJECTORY_DUMP_PARSE_FAILED,
                'Trajectory dump does not contain atom headers',
                500
            );
        }

        if (totalAtoms === 0 && atomIndex > 0) {
            totalAtoms = atomIndex;
        }

        return {
            atoms,
            totalAtoms
        };
    }

    private getAtomColumnIndexes(headerLine: string): AtomColumnIndexes {
        const headers = headerLine
            .replace('ITEM: ATOMS', '')
            .trim()
            .split(/\s+/)
            .map((header) => header.toLowerCase());

        return {
            id: this.getHeaderIndex(headers, ['id']),
            type: this.getHeaderIndex(headers, ['type']),
            x: this.getHeaderIndex(headers, ['x', 'xu', 'xs', 'xsu']),
            y: this.getHeaderIndex(headers, ['y', 'yu', 'ys', 'ysu']),
            z: this.getHeaderIndex(headers, ['z', 'zu', 'zs', 'zsu'])
        };
    }

    private getHeaderIndex(headers: string[], candidates: string[]): number {
        for (const candidate of candidates) {
            const headerIndex = headers.indexOf(candidate);
            if (headerIndex !== -1) {
                return headerIndex;
            }
        }

        throw new ApplicationError(
            ErrorCodes.TRAJECTORY_DUMP_PARSE_FAILED,
            `Trajectory dump is missing required atom column: ${candidates[0]}`,
            500
        );
    }

    private parseAtomLine(line: string, columns: AtomColumnIndexes): AtomPageEntry {
        const values = line.split(/\s+/);
        const atom = {
            id: Number(values[columns.id]),
            type: Number(values[columns.type]),
            x: Number(values[columns.x]),
            y: Number(values[columns.y]),
            z: Number(values[columns.z])
        };

        if (
            Number.isNaN(atom.id) ||
            Number.isNaN(atom.type) ||
            Number.isNaN(atom.x) ||
            Number.isNaN(atom.y) ||
            Number.isNaN(atom.z)
        ) {
            throw new ApplicationError(
                ErrorCodes.TRAJECTORY_DUMP_PARSE_FAILED,
                'Trajectory dump contains invalid atom values',
                500
            );
        }

        return atom;
    }

    private getDumpObjectKey(trajectoryId: string, timestep: string | number): string {
        return `trajectory-${trajectoryId}/timestep-${timestep}.dump.gz`;
    }
};
