import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';
import { parseLocalDate } from '../utils/dateUtils';

interface Member {
    id: string;
    name: string;
    war_name: string | null;
    rank: string | null;
    abrev: string | null;
    status: string | null;
    sector?: string;
}

interface User {
    id: string;
    war_name: string;
    rank: string;
    abrev: string;
    sector?: string;
}

interface MemberWithDiarias extends Member {
    diariasNoAno: number;
}

const ScheduleAdjustment: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const missionId = searchParams.get('id');
    const isEditMode = !!missionId;

    // Form state
    const [nome, setNome] = useState('');
    const [descricao, setDescricao] = useState('');
    const [local, setLocal] = useState('');
    const [deslocamento, setDeslocamento] = useState('Aéreo');
    const [qtdEquipeManual, setQtdEquipeManual] = useState(0);
    const [fav, setFav] = useState(false);
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [selectedTeam, setSelectedTeam] = useState<string[]>([]);
    const [selectedSector, setSelectedSector] = useState<'CP' | 'EA' | ''>('');
    const [maxOficialDiarias, setMaxOficialDiarias] = useState(0);
    const [maxGraduadoDiarias, setMaxGraduadoDiarias] = useState(0);

    // UI state
    const [members, setMembers] = useState<MemberWithDiarias[]>([]);
    const [filterText, setFilterText] = useState('');
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [isSelectingStart, setIsSelectingStart] = useState(true);
    const [loading, setLoading] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    useEffect(() => {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                setCurrentUser(user);
                // Pre-set sector if not CH
                if (user.sector !== 'CH') {
                    setSelectedSector(user.sector as 'CP' | 'EA');
                }
            } catch (e) {
                console.error("Error parsing user from localStorage", e);
            }
        }

        if (isEditMode) {
            loadMission(missionId);
        }
    }, [missionId, isEditMode]);

    // Re-fetch members whenever the effective sector changes
    useEffect(() => {
        const activeSector = currentUser?.sector === 'CH' ? selectedSector : currentUser?.sector;
        if (activeSector) {
            fetchMembersWithDiarias(activeSector);
        }
    }, [selectedSector, currentUser]);

    const getRankPriority = (rank: string | null, abrev: string | null): number => {
        const s = (rank || abrev || '').toUpperCase();
        if (s.includes('MAJ')) return 0;
        if (s.includes('CAP')) return 1;
        if (s.includes('1º TEN') || s.includes('1TEN')) return 2;
        if (s.includes('2º TEN') || s.includes('2TEN')) return 3;
        if (s.includes('SUB') || s.includes('SO')) return 4;
        if (s.includes('1º SAR') || s.includes('1SGT') || (s.includes('1º') && s.includes('SGT'))) return 5;
        if (s.includes('2º SAR') || s.includes('2SGT') || (s.includes('2º') && s.includes('SGT'))) return 6;
        if (s.includes('3º SAR') || s.includes('3SGT') || (s.includes('3º') && s.includes('SGT'))) return 7;
        if (s.includes('CIVIL')) return 8;
        
        // Fallback checks for simple abbreviations if the specific ones above aren't found
        if (s.includes('TEN')) return 2;
        if (s.includes('SGT')) return 7;
        
        return 9;
    };

    const fetchMembersWithDiarias = async (filterSector?: string) => {
        const year = new Date().getFullYear();
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;

        // Fetch members of the relevant sector
        let query = supabase
            .from('members')
            .select('id, name, war_name, rank, abrev, status, sector');
        
        if (filterSector) {
            query = query.eq('sector', filterSector);
        }

        const { data: membersData, error: membersError } = await query;

        if (membersError || !membersData) return;

        // Fetch all missions for the year to calculate totals
        const { data: missionsData } = await supabase
            .from('missions')
            .select('equipe, data_inicio, data_fim, sector')
            .gte('data_inicio', startDate)
            .lte('data_inicio', endDate);

        // Calculate diárias for each member
        const membersWithDiarias: MemberWithDiarias[] = membersData
            .map(member => {
                let totalDiarias = 0;
                if (missionsData) {
                    missionsData.forEach(mission => {
                        // Only count mission days if the mission matches the member's sector
                        // (Usually they match, but this is safer)
                        if (mission.sector === member.sector && mission.equipe && mission.equipe.includes(member.id)) {
                            const duration = calculateDuration(mission.data_inicio, mission.data_fim);
                            totalDiarias += duration;
                        }
                    });
                }
                return { ...member, diariasNoAno: totalDiarias };
            });

        // Identify max diárias for Oficiais and Graduados in THIS sector
        let maxOf = 0;
        let maxGrad = 0;

        membersWithDiarias.forEach(m => {
            const priority = getRankPriority(m.rank, m.abrev);
            if (priority <= 3) { // Oficiais: Maj, Cap, Ten
                if (m.diariasNoAno > maxOf) maxOf = m.diariasNoAno;
            } else if (priority <= 8) { // Graduados: SO, Sgt, Civil
                if (m.diariasNoAno > maxGrad) maxGrad = m.diariasNoAno;
            }
        });

        setMaxOficialDiarias(maxOf);
        setMaxGraduadoDiarias(maxGrad);

        // Sort and set
        const sortedMembers = membersWithDiarias.sort((a, b) => {
            const pA = getRankPriority(a.rank, a.abrev);
            const pB = getRankPriority(b.rank, b.abrev);
            if (pA !== pB) return pA - pB;
            const nameA = a.war_name || a.name || '';
            const nameB = b.war_name || b.name || '';
            return nameA.localeCompare(nameB);
        });

        setMembers(sortedMembers);
    };

    const loadMission = async (id: string) => {
        const { data, error } = await supabase
            .from('missions')
            .select('*')
            .eq('id', id)
            .single();

        if (!error && data) {
            setNome(data.nome);
            setDescricao(data.descricao || '');
            setLocal(data.local);
            setDeslocamento(data.deslocamento);
            if (!data.equipe || data.equipe.length === 0) {
                setQtdEquipeManual(data.qtd_equipe || 0);
            }
            setFav(data.fav);
            setDataInicio(data.data_inicio);
            setDataFim(data.data_fim);
            setSelectedTeam(data.equipe || []);
            
            // Set sector for filtering members
            if (data.sector) {
                setSelectedSector(data.sector);
            }
            
            // Set calendar to mission month
            const missionDate = parseLocalDate(data.data_inicio) || new Date();
            setCurrentMonth(missionDate.getMonth());
            setCurrentYear(missionDate.getFullYear());
        }
    };

    const calculateDuration = (startDate: string, endDate: string): number => {
        const start = parseLocalDate(startDate);
        const end = parseLocalDate(endDate);
        if (!start || !end) return 0;
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays + 0.5;
    };

    const getDaysInMonth = (month: number, year: number): number => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getStartDayOfMonth = (month: number, year: number): number => {
        return new Date(year, month, 1).getDay();
    };

    const handlePrevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
    };

    const handleNextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
    };

    const handleDayClick = (day: number) => {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        if (isSelectingStart || !dataInicio) {
            setDataInicio(dateStr);
            setDataFim('');
            setIsSelectingStart(false);
        } else {
            const currentObj = parseLocalDate(dateStr)?.getTime() || 0;
            const startObj = parseLocalDate(dataInicio)?.getTime() || 0;
            
            if (currentObj >= startObj) {
                setDataFim(dateStr);
            } else {
                setDataFim(dataInicio);
                setDataInicio(dateStr);
            }
            setIsSelectingStart(true);
        }
    };

    const isDayInRange = (day: number): 'start' | 'end' | 'middle' | null => {
        if (!dataInicio) return null;
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        if (dateStr === dataInicio) return 'start';
        if (dataFim && dateStr === dataFim) return 'end';

        const current = parseLocalDate(dateStr)?.getTime() || 0;
        const start = parseLocalDate(dataInicio)?.getTime() || 0;
        const end = dataFim ? (parseLocalDate(dataFim)?.getTime() || 0) : null;

        if (end && current > start && current < end) return 'middle';
        return null;
    };

    const toggleMember = (memberId: string) => {
        if (selectedTeam.includes(memberId)) {
            setSelectedTeam(selectedTeam.filter(id => id !== memberId));
        } else {
            setSelectedTeam([...selectedTeam, memberId]);
        }
    };

    const removeMember = (memberId: string) => {
        setSelectedTeam(selectedTeam.filter(id => id !== memberId));
    };

    const getMemberDisplay = (member: MemberWithDiarias): string => {
        if (member.abrev && member.war_name) {
            return `${member.abrev} ${member.war_name}`;
        }
        return member.war_name || member.name;
    };

    const filteredMembers = members.filter(m => 
        getMemberDisplay(m).toLowerCase().includes(filterText.toLowerCase())
    );

    const estimatedDiarias = dataInicio && dataFim ? calculateDuration(dataInicio, dataFim) : 0;

    const formatDateDisplay = (dateStr: string): string => {
        if (!dateStr) return '--/--';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}`;
    };


    // Helper to adjust date if weekend
    const adjustIfWeekend = (date: Date): Date => {
        const day = date.getDay();
        if (day === 0) { // Sunday
            date.setDate(date.getDate() - 2); // Friday
        } else if (day === 6) { // Saturday
            date.setDate(date.getDate() - 1); // Friday
        }
        return date;
    };

    const handleSave = async () => {
        if (!nome || !local || !dataInicio || !dataFim) {
            alert('Preencha todos os campos obrigatórios');
            return;
        }

        if (currentUser?.sector === 'CH' && !isEditMode && !selectedSector) {
            alert('Por favor, selecione para qual seção (Capacidade ATC ou Espaço Aéreo) esta missão será criada.');
            return;
        }

        setLoading(true);

        const missionData = {
            nome,
            descricao: descricao || null,
            local,
            data_inicio: dataInicio,
            data_fim: dataFim,
            deslocamento,
            fav,
            qtd_equipe: selectedTeam.length > 0 ? selectedTeam.length : qtdEquipeManual,
            equipe: selectedTeam.length > 0 ? selectedTeam : null,
            sector: isEditMode ? undefined : (currentUser?.sector === 'CH' ? selectedSector : currentUser?.sector)
        };
        
        console.log('Final missionData with sector:', missionData);

        try {
            if (isEditMode) {
                const { error } = await supabase
                    .from('missions')
                    .update(missionData)
                    .eq('id', missionId);

                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('missions')
                    .insert([missionData]);

                if (error) throw error;

                // Create Task if FAV is false
                if (fav === false) {
                    const missionStart = parseLocalDate(dataInicio) || new Date();
                    const missionStartCopy1 = parseLocalDate(dataInicio) || new Date();
                    const missionStartCopy2 = parseLocalDate(dataInicio) || new Date();

                    // Start Date: 50 days before (adjusted to previous Friday if weekend)
                    missionStartCopy1.setDate(missionStartCopy1.getDate() - 50);
                    const startDateAdjusted = adjustIfWeekend(missionStartCopy1);

                    // End Date: 45 days before
                    missionStartCopy2.setDate(missionStartCopy2.getDate() - 45);

                    const newTask = {
                        name: 'Confecção de FAV',
                        description: `Missão: ${nome}`,
                        category: 'Confecção de FAV', // Confecção de FAV
                        periodicity: 'pontual',
                        specialties: ['BCT', 'AIS'], // BCT and AIS
                        recurrence_active: false,
                        start_date: startDateAdjusted.toISOString(),
                        end_date: missionStartCopy2.toISOString(),
                        status: 'pendente',
                        quantidade: 1, // User said 1 or team size, deciding on 1 for document task
                        created_at: new Date().toISOString(),
                        sector: currentUser?.sector
                    };

                    const { error: taskError } = await supabase
                        .from('tasks')
                        .insert([newTask]);

                    if (taskError) {
                        console.error('Error creating linked task:', taskError);
                    }
                }
            }

            navigate('/app/schedule');
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar missão');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-[#0d141b] dark:text-white text-3xl font-black tracking-tight mb-2">
                        {isEditMode ? 'Editar Missão' : 'Cadastrar Nova Viagem'}
                    </h1>
                    <p className="text-[#4c739a] dark:text-slate-400">Gerencie a distribuição de diárias e membros da equipe técnica.</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => navigate('/app/schedule')} className="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95">Cancelar</button>
                    <button 
                        onClick={handleSave}
                        disabled={loading}
                        className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50"
                    >
                        <span className="material-symbols-outlined text-sm">send</span> 
                        {loading ? 'Salvando...' : (isEditMode ? 'Salvar Alterações' : 'Finalizar Planejamento')}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                <div className="xl:col-span-8 space-y-6">
                    {/* Mission Info */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#e7edf3] dark:border-slate-800 overflow-hidden shadow-sm">
                        <div className="border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">info</span>
                            <h2 className="text-slate-900 dark:text-white font-bold">Informações da Missão</h2>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="flex flex-col gap-2">
                                <label className="text-slate-700 dark:text-slate-300 text-sm font-bold">Nome da Missão *</label>
                                <input 
                                    value={nome}
                                    onChange={(e) => setNome(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-primary h-12 px-4 text-sm" 
                                    placeholder="Ex: Manutenção Preventiva de Radares" 
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-slate-700 dark:text-slate-300 text-sm font-bold">Descrição</label>
                                <textarea 
                                    value={descricao}
                                    onChange={(e) => setDescricao(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-primary px-4 py-3 text-sm min-h-[80px]" 
                                    placeholder="Descrição detalhada da missão (opcional)" 
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="flex flex-col gap-2">
                                    <label className="text-slate-700 dark:text-slate-300 text-sm font-bold">Destino *</label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-3 top-3 text-slate-400 text-xl">location_on</span>
                                        <input 
                                            value={local}
                                            onChange={(e) => setLocal(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-primary h-12 pl-11 text-sm" 
                                            placeholder="Ex: Guarulhos - SP" 
                                        />
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-slate-700 dark:text-slate-300 text-sm font-bold">Tamanho da Equipe</label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-3 top-3 text-slate-400 text-xl">groups</span>
                                        <input 
                                            type="number"
                                            value={selectedTeam.length > 0 ? selectedTeam.length : (qtdEquipeManual || '')}
                                            onChange={(e) => setQtdEquipeManual(Number(e.target.value))}
                                            disabled={selectedTeam.length > 0}
                                            className={`w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-primary h-12 pl-11 text-sm ${selectedTeam.length > 0 ? 'opacity-70 cursor-not-allowed font-bold text-primary' : ''}`} 
                                            placeholder="Qtd de integrantes (se equipe estiver vazia)" 
                                        />
                                        {selectedTeam.length > 0 && (
                                            <span className="absolute right-3 top-3 text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-lg">DEFINIDO PELA EQUIPE</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="flex flex-col gap-2">
                                    <label className="text-slate-700 dark:text-slate-300 text-sm font-bold">Deslocamento</label>
                                    <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl h-12">
                                        {['Aéreo', 'Terrestre'].map(d => (
                                            <button 
                                                key={d}
                                                onClick={() => setDeslocamento(d)}
                                                className={`flex-1 rounded-lg font-bold text-xs transition-all active:scale-95 ${deslocamento === d ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-slate-700 dark:text-slate-300 text-sm font-bold">FAVs Confeccionadas?</label>
                                    <div className="flex p-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl h-12">
                                        <button 
                                            onClick={() => setFav(true)}
                                            className={`flex-1 rounded-lg font-bold text-xs transition-all active:scale-95 ${fav ? 'bg-white dark:bg-slate-700 shadow-sm text-green-600' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Sim
                                        </button>
                                        <button 
                                            onClick={() => setFav(false)}
                                            className={`flex-1 rounded-lg font-bold text-xs transition-all active:scale-95 ${!fav ? 'bg-white dark:bg-slate-700 shadow-sm text-red-600' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            Não
                                        </button>
                                    </div>
                                </div>
                                {currentUser?.sector === 'CH' && !isEditMode && (
                                    <div className="flex flex-col gap-2">
                                        <label className="text-slate-700 dark:text-slate-300 text-sm font-bold">Seção de Destino *</label>
                                        <select 
                                            value={selectedSector}
                                            onChange={(e) => setSelectedSector(e.target.value)}
                                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-primary h-12 px-4 text-sm"
                                        >
                                            <option value="">Selecione o Setor...</option>
                                            <option value="CP">Capacidade ATC (CP)</option>
                                            <option value="EA">Espaço Aéreo (EA)</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#e7edf3] dark:border-slate-800 overflow-hidden shadow-sm">
                        <div className="border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">calendar_today</span>
                                <h2 className="text-slate-900 dark:text-white font-bold">Período Selecionado</h2>
                            </div>
                            <div className="flex items-center gap-4">
                                <button onClick={handlePrevMonth} className="size-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95">
                                    <span className="material-symbols-outlined text-lg">chevron_left</span>
                                </button>
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 min-w-[120px] text-center">{monthNames[currentMonth]} {currentYear}</span>
                                <button onClick={handleNextMonth} className="size-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95">
                                    <span className="material-symbols-outlined text-lg">chevron_right</span>
                                </button>
                            </div>
                        </div>
                        <div className="p-6">
                            {/* Date inputs */}
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="flex flex-col gap-2">
                                    <label className="text-slate-700 dark:text-slate-300 text-sm font-bold">Data Início *</label>
                                    <input 
                                        type="text"
                                        value={dataInicio}
                                        onChange={(e) => setDataInicio(e.target.value)}
                                        placeholder="AAAA-MM-DD"
                                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-primary h-12 px-4 text-sm"
                                    />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-slate-700 dark:text-slate-300 text-sm font-bold">Data Fim *</label>
                                    <input 
                                        type="text"
                                        value={dataFim}
                                        onChange={(e) => setDataFim(e.target.value)}
                                        placeholder="AAAA-MM-DD"
                                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 focus:ring-primary h-12 px-4 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-black text-slate-400 mb-4 uppercase tracking-tighter">
                                <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
                            </div>
                            <div className="grid grid-cols-7 gap-2">
                                {Array.from({ length: getStartDayOfMonth(currentMonth, currentYear) }).map((_, i) => (
                                    <div key={`empty-${i}`} className="h-10 flex items-center justify-center text-slate-300 text-sm"></div>
                                ))}
                                {Array.from({ length: getDaysInMonth(currentMonth, currentYear) }).map((_, i) => {
                                    const day = i + 1;
                                    const rangeState = isDayInRange(day);
                                    
                                    let bgClass = "bg-slate-50 dark:bg-slate-800 hover:bg-slate-100";
                                    let textClass = "";
                                    let roundedClass = "rounded-xl";

                                    if (rangeState === 'start') {
                                        bgClass = "bg-primary text-white";
                                        roundedClass = "rounded-l-xl";
                                    } else if (rangeState === 'end') {
                                        bgClass = "bg-primary text-white";
                                        roundedClass = "rounded-r-xl";
                                    } else if (rangeState === 'middle') {
                                        bgClass = "bg-primary/20 text-primary";
                                        roundedClass = "";
                                    }

                                    return (
                                        <div 
                                            key={day}
                                            onClick={() => handleDayClick(day)}
                                            className={`h-10 flex items-center justify-center font-bold text-sm cursor-pointer transition-all ${bgClass} ${textClass} ${roundedClass}`}
                                        >
                                            {day}
                                        </div>
                                    );
                                })}
                            </div>
                            {dataInicio && dataFim && (
                                <div className="mt-6 p-4 bg-primary/5 dark:bg-primary/10 rounded-xl border border-primary/10 flex items-center gap-4">
                                    <div className="size-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                                        <span className="material-symbols-outlined">event_note</span>
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-500 uppercase">Resumo de Datas</p>
                                        <p className="text-sm dark:text-slate-200">De <span className="font-bold text-primary">{formatDateDisplay(dataInicio)}</span> a <span className="font-bold text-primary">{formatDateDisplay(dataFim)}</span> — {estimatedDiarias} diárias estimadas</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Team Selection Sidebar */}
                <div className="xl:col-span-4 space-y-6">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#e7edf3] dark:border-slate-800 overflow-hidden shadow-sm">
                        <div className="border-b border-slate-100 dark:border-slate-800 px-6 py-4 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-800/30">
                            <span className="material-symbols-outlined text-primary">groups</span>
                            <h2 className="text-slate-900 dark:text-white font-bold">Equipe da Missão</h2>
                        </div>
                        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                            <div className="relative">
                                <span className="material-symbols-outlined absolute left-3 top-2 text-slate-400 text-lg">search</span>
                                <input 
                                    value={filterText}
                                    onChange={(e) => setFilterText(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800/50 border-none rounded-lg focus:ring-1 focus:ring-primary" 
                                    placeholder="Filtrar integrantes..." 
                                />
                            </div>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto p-2 space-y-1">
                            {filteredMembers.map(member => {
                                const isSelected = selectedTeam.includes(member.id);
                                const isAvailable = member.status === 'Ativo';
                                const priority = getRankPriority(member.rank, member.abrev);
                                const isOficial = priority <= 3;
                                const isGraduado = priority > 3 && priority <= 8;
                                
                                // Highlight only if total > 0 and it's the max for their group in this sector
                                const isHighlighted = (isOficial && member.diariasNoAno === maxOficialDiarias && maxOficialDiarias > 0) ||
                                                    (isGraduado && member.diariasNoAno === maxGraduadoDiarias && maxGraduadoDiarias > 0);

                                const diariasClass = isHighlighted 
                                    ? 'text-amber-600 font-bold uppercase tracking-wider' 
                                    : 'text-slate-500';

                                return (
                                    <div 
                                        key={member.id}
                                        onClick={() => toggleMember(member.id)}
                                        className={`flex items-center justify-between p-3 rounded-xl transition-colors cursor-pointer ${
                                            isSelected 
                                                ? 'bg-primary/5 dark:bg-primary/10 border border-primary/20' 
                                                : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`size-2 rounded-full ${isAvailable ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                                            <div>
                                                <p className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-slate-800 dark:text-slate-200'}`}>
                                                    {getMemberDisplay(member)}
                                                </p>
                                                <p className={`text-[10px] ${isSelected ? 'text-primary/70' : diariasClass}`}>
                                                    ({String(member.diariasNoAno).padStart(2, '0')} diárias no ano)
                                                </p>
                                            </div>
                                        </div>
                                        <span className={`material-symbols-outlined ${isSelected ? 'text-primary' : 'text-slate-300 group-hover:text-primary'}`}>
                                            {isSelected ? 'check_circle' : 'add_circle'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="p-5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex justify-between items-center mb-3">
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Equipe Selecionada</span>
                                <span className="bg-primary text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                                    {selectedTeam.length} {selectedTeam.length === 1 ? 'INTEGRANTE' : 'INTEGRANTES'}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {selectedTeam.map(memberId => {
                                    const member = members.find(m => m.id === memberId);
                                    if (!member) return null;
                                    return (
                                        <div key={memberId} className="flex items-center gap-2 bg-white dark:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 shadow-sm">
                                            <span className="text-xs font-bold dark:text-white">{getMemberDisplay(member)}</span>
                                            <span 
                                                onClick={(e) => { e.stopPropagation(); removeMember(memberId); }}
                                                className="material-symbols-outlined text-base text-slate-400 hover:text-red-500 cursor-pointer"
                                            >
                                                close
                                            </span>
                                        </div>
                                    );
                                })}
                                {selectedTeam.length === 0 && (
                                    <p className="text-xs text-slate-400">Nenhum integrante selecionado</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-primary rounded-2xl p-6 text-white shadow-xl shadow-primary/20 relative overflow-hidden">
                        <span className="material-symbols-outlined absolute -right-4 -bottom-4 text-9xl opacity-10 rotate-12">summarize</span>
                        <h3 className="text-xs font-black opacity-70 uppercase tracking-[0.2em] mb-6">Resumo Estimado</h3>
                        <div className="space-y-4 relative z-10">
                            <div className="flex justify-between items-center border-b border-white/10 pb-3">
                                <span className="text-sm opacity-90">Diárias (Total)</span>
                                <span className="font-bold text-lg">{estimatedDiarias.toFixed(1)}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-white/10 pb-3">
                                <span className="text-sm opacity-90">Integrantes</span>
                                <span className="font-bold text-lg">{String(selectedTeam.length).padStart(2, '0')}</span>
                            </div>
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-sm opacity-90">Status</span>
                                <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded uppercase">Em Planejamento</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ScheduleAdjustment;