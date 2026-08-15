import { supabase } from '../supabase';

const getRankPriority = (rankStr: string | null, abrevStr: string | null): number => {
    const s = (rankStr || abrevStr || '').toUpperCase().trim();
    if (s.includes('MAJOR') || s.includes('MAJ')) return 0;
    if (s.includes('CAPIT')) return 1;
    if (s.includes('1º TEN') || s.includes('1.º TEN') || s.includes('1TEN')) return 2;
    if (s.includes('2º TEN') || s.includes('2.º TEN') || s.includes('2TEN') || s.includes('ASP')) return 3;
    if (s.includes('SUBOF') || s.includes('SO.')) return 4;
    if (s.includes('1º SAR') || s.includes('1.º SAR') || s.includes('1SGT')) return 5;
    if (s.includes('2º SAR') || s.includes('2.º SAR') || s.includes('2SGT')) return 6;
    if (s.includes('3º SAR') || s.includes('3.º SAR') || s.includes('3SGT')) return 7;
    if (s.includes('SGT')) return 7;
    if (s.includes('CIV')) return 8;
    return 99;
};

export const isOfficer = (rank: string | null, abrev: string | null): boolean => {
    const priority = getRankPriority(rank, abrev);
    return priority >= 0 && priority <= 3;
};

export const canAccessScheduleAndReports = async (user: any): Promise<boolean> => {
    if (!user) return false;

    // Oficiais sempre têm acesso
    if (isOfficer(user.rank, user.abrev)) {
        return true;
    }

    // Se é encarregado, tem acesso
    if (user.encarregado) {
        return true;
    }

    // Verificar se o setor (CP, EA ou CH) possui algum encarregado cadastrado
    const userSector = user.sector;
    if (!userSector) return true;

    try {
        const { data, error } = await supabase
            .from('members')
            .select('id')
            .eq('sector', userSector)
            .eq('encarregado', true);

        if (error) throw error;

        // Caso o setor NÃO tenha nenhum encarregado cadastrado, todos têm acesso
        if (!data || data.length === 0) {
            return true;
        }
    } catch (err) {
        console.error('Error checking sector encarregados:', err);
    }

    return false;
};

export const hasSectorEncarregado = async (sector: string | null): Promise<boolean> => {
    if (!sector) return false;
    try {
        const { data, error } = await supabase
            .from('members')
            .select('id')
            .eq('sector', sector)
            .eq('encarregado', true);

        if (error) throw error;
        return !!(data && data.length > 0);
    } catch (err) {
        console.error('Error checking if sector has encarregado:', err);
        return false;
    }
};

export const shouldFilterUnvalidatedMissions = async (user: any): Promise<boolean> => {
    if (!user) return false;

    // Oficiais e Encarregados podem ver TODAS as missões (independente de estarem validadas)
    if (isOfficer(user.rank, user.abrev) || user.encarregado) {
        return false;
    }

    // Se o usuário é Sargento sem encarregado, só filtramos se o setor dele TIVER algum encarregado cadastrado
    const userSector = user.sector;
    if (!userSector) return false;

    const hasEncarregado = await hasSectorEncarregado(userSector);
    // Se o setor tem encarregado, então filtramos as missões não validadas para este usuário
    return hasEncarregado;
};
