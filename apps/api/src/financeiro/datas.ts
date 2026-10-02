// Datas de negócio chegam como "YYYY-MM-DD" e são gravadas em UTC (meia-noite
// UTC); a conversão para America/Sao_Paulo é só de apresentação.
export const dataUtc = (data: string): Date => new Date(`${data}T00:00:00.000Z`);

export const formatarData = (data: Date): string => data.toISOString().slice(0, 10);
