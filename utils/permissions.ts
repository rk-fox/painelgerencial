import { supabase } from '../supabase';
import { Member } from '../types';

export const getRankPriority = (rankStr: string | null, abrevStr: string | null): number => {
    const s = (rankStr || abrevStr || '').toUpperCase().trim();
    if (s.includes('TEN CEL') || s.includes('TCEL') || s.includes('T.CEL')) return -1;
    if (s.includes('MAJOR') || s.includes('MAJ')) return 0;
    if (s.includes('CAPIT')) return 1;
    if (s.includes('1º TEN') || s.includes('1.º TEN') || s.includes('1TEN')) return 2;
    if (s.includes('2º TEN') || s.includes('2.º TEN') || s.includes('2TEN') || s.includes('ASP')) return 3;
    if (s.includes('SUBOF') || s.includes('SO.') || s.includes('SO')) return 4;
    if (s.includes('1º SAR') || s.includes('1.º SAR') || s.includes('1SGT') || (s.includes('1º') && s.includes('SGT'))) return 5;
    if (s.includes('2º SAR') || s.includes('2.º SAR') || s.includes('2SGT') || (s.includes('2º') && s.includes('SGT'))) return 6;
    if (s.includes('3º SAR') || s.includes('3.º SAR') || s.includes('3SGT') || (s.includes('3º') && s.includes('SGT'))) return 7;
    if (s.includes('SGT')) return 7;
    if (s.includes('CIV')) return 8;
    if (s.includes('TEN')) return 2;
    return 99;
};

export const compareMembersByRank = (
    a: { rank?: string | null; abrev?: string | null; last_promotion_date?: string | null; guia_antiguidade?: number | null },
    b: { rank?: string | null; abrev?: string | null; last_promotion_date?: string | null; guia_antiguidade?: number | null }
): number => {
    const pA = getRankPriority(a.rank ?? null, a.abrev ?? null);
    const pB = getRankPriority(b.rank ?? null, b.abrev ?? null);
    if (pA !== pB) return pA - pB;

    const dateA = a.last_promotion_date ? new Date(a.last_promotion_date).getTime() : Infinity;
    const dateB = b.last_promotion_date ? new Date(b.last_promotion_date).getTime() : Infinity;
    if (dateA !== dateB) return dateA - dateB;

    const guiaA = a.guia_antiguidade ?? 9999;
    const guiaB = b.guia_antiguidade ?? 9999;
    return guiaA - guiaB;
};

export const isOfficer = (rank: string | null, abrev: string | null): boolean => {
    const priority = getRankPriority(rank, abrev);
    return priority >= -1 && priority <= 3;
};

export interface SeniorityTieGroup {
    key: string;
    rank: string;
    abrev?: string;
    last_promotion_date: string;
    members: Member[];
    isResolved: boolean;
}

export const findSeniorityTies = (members: Member[]): SeniorityTieGroup[] => {
    const groups: Record<string, Member[]> = {};

    members.forEach(m => {
        const isCivil = (m.rank || '').toUpperCase().includes('CIV') || (m.abrev || '').toUpperCase().includes('CV');
        if (m.rank && m.last_promotion_date && !isCivil) {
            const key = `${m.rank}___${m.last_promotion_date}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(m);
        }
    });

    const ties: SeniorityTieGroup[] = [];
    Object.entries(groups).forEach(([key, groupMembers]) => {
        if (groupMembers.length > 1) {
            const [rank, last_promotion_date] = key.split('___');
            const guias = groupMembers.map(m => m.guia_antiguidade);
            const hasNulls = guias.some(g => g === null || g === undefined);
            const hasDuplicates = new Set(guias).size !== guias.length;
            const isResolved = !hasNulls && !hasDuplicates;

            ties.push({
                key,
                rank,
                abrev: groupMembers[0]?.abrev,
                last_promotion_date,
                members: groupMembers,
                isResolved
            });
        }
    });

    return ties;
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
