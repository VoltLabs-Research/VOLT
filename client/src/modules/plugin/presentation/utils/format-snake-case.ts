const formatSnakeCaseToTitle = (snakeCase: string): string => {
    return snakeCase
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

export default formatSnakeCaseToTitle;
