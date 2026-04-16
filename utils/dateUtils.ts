export const parseLocalDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;
    
    // If it's exactly a date-only YYYY-MM-DD string (length 10)
    // we manually build in the local timezone to avoid the UTC midnight assumption 
    // that causes it to regress by one day in America timezone regions.
    if (dateStr.length === 10 && dateStr.includes('-')) {
        const [year, month, day] = dateStr.split('-').map(Number);
        // this creates the date in the local timezone (UTC-3 directly)
        return new Date(year, month - 1, day);
    }
    
    // For timestamps like "2026-01-29 11:02:42.92949-03" or ISO formats
    // The native date parser correctly maps it observing its explicit timezone offset
    return new Date(dateStr);
};

export const formatLocalDate = (dateStr: string | null | undefined, placeholder: string = '—'): string => {
    const date = parseLocalDate(dateStr);
    if (!date) return placeholder;
    return date.toLocaleDateString('pt-BR');
};
