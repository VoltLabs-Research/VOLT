interface DailyActivityTokens {
    readonly DailyActivityRepository: symbol;
    readonly FindActivityByTeamIdUseCase: symbol;
    readonly UpdateUserActivityUseCase: symbol;
}

export const DAILY_ACTIVITY_TOKENS: DailyActivityTokens = {
    DailyActivityRepository: Symbol.for('DailyActivityRepository'),
    FindActivityByTeamIdUseCase: Symbol.for('FindActivityByTeamIdUseCase'),
    UpdateUserActivityUseCase: Symbol.for('UpdateUserActivityUseCase')
};
