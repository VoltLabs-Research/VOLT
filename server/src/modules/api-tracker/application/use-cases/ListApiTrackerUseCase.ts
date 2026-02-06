import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { IApiTrackerRepository } from '@modules/api-tracker/domain/ports/IApiTrackerRepository';
import { ListApiTrackerInputDTO, ListApiTrackerOutputDTO } from '@modules/api-tracker/application/dtos/ListApiTrackerDTO';

@injectable()
export class ListApiTrackerUseCase implements IUseCase<ListApiTrackerInputDTO, ListApiTrackerOutputDTO> {
    constructor(
        @inject('IApiTrackerRepository') private repository: IApiTrackerRepository
    ){}

    async execute(input: ListApiTrackerInputDTO): Promise<Result<ListApiTrackerOutputDTO>> {
        const page = input.page || 1;
        const limit = input.limit || 50;

        const { items, total } = await this.repository.findByUserId(input.userId, page, limit);

        return Result.ok({
            items: items.map(item => ({
                id: item.id,
                method: item.method,
                url: item.url,
                userAgent: item.userAgent,
                ip: item.ip,
                statusCode: item.statusCode,
                responseTime: item.responseTime,
                requestBody: item.requestBody,
                queryParams: item.queryParams,
                headers: item.headers,
                createdAt: item.createdAt
            })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });
    }
}
