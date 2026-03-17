import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

interface Member {
    id: string;
    name: string;
    war_name: string | null;
    rank: string | null;
    abrev: string | null;
}

interface Sdia {
    id: string;
    nr_sdia: string;
    nr_solicitacao: string;
    titulo_sdia: string;
    indicativo: string;
    descricao: string;
    data_inicio: string;
    data_fim: string;
    tipo: string;
    analise: string;
    impacto: boolean;
    analista: string;
    created_at?: string;
}

const SdiaPage: React.FC = () => {
    const navigate = useNavigate();
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [availableYears, setAvailableYears] = useState<number[]>([]);
    const [sdias, setSdias] = useState<Sdia[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
    const [isMonthPopupOpen, setIsMonthPopupOpen] = useState(false);
    
    // Form State
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingSdia, setEditingSdia] = useState<Sdia | null>(null);
    const [formData, setFormData] = useState<Partial<Sdia>>({
        titulo_sdia: '',
        indicativo: '',
        tipo: '',
        nr_sdia: '',
        nr_solicitacao: '',
        descricao: '',
        analise: '',
        impacto: false,
        analista: '',
        data_inicio: new Date().toISOString().split('T')[0],
        data_fim: new Date().toISOString().split('T')[0]
    });

    const [sdiaToDelete, setSdiaToDelete] = useState<Sdia | null>(null);

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    useEffect(() => {
        fetchAvailableYears();
        fetchMembers();
    }, []);

    useEffect(() => {
        if (selectedYear) {
            fetchSdias(selectedYear);
        }
    }, [selectedYear]);

    const fetchAvailableYears = async () => {
        const { data, error } = await supabase
            .from('sdia')
            .select('data_inicio');
        if (!error && data) {
            const years = [...new Set(data.map(m => new Date(m.data_inicio).getFullYear()))].sort((a, b) => b - a);
            setAvailableYears(years.length > 0 ? years : [new Date().getFullYear()]);
            if (years.length > 0 && !years.includes(selectedYear)) {
                setSelectedYear(years[0]);
            }
        } else {
            setAvailableYears([new Date().getFullYear()]);
        }
    };

    const fetchSdias = async (year: number) => {
        const startDate = `${year}-01-01`;
        const endDate = `${year}-12-31`;
        
        const { data, error } = await supabase
            .from('sdia')
            .select('*')
            .gte('data_inicio', startDate)
            .lte('data_inicio', endDate)
            .order('data_inicio');
        if (!error && data) {
            setSdias(data);
        }
    };

    const fetchMembers = async () => {
        const { data, error } = await supabase
            .from('members')
            .select('id, name, war_name, rank, abrev')
            .order('name');
        if (!error && data) {
            setMembers(data);
        }
    };

    const getAnalystName = (id: string): string => {
        const member = members.find(m => m.id === id);
        return member ? `${member.abrev || ''} ${member.war_name || member.name}` : 'Desconhecido';
    };

    const formatDateString = (dateString: string): string => {
        if (!dateString) return '';
        const parts = dateString.split('T')[0].split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    const getSdiasForMonth = (month: number): Sdia[] => {
        const firstDayOfMonth = new Date(selectedYear, month, 1).getTime();
        const lastDayOfMonth = new Date(selectedYear, month + 1, 0, 23, 59, 59).getTime();

        return sdias.filter(s => {
            const sParts = s.data_inicio.split('T')[0].split('-').map(Number);
            const eParts = s.data_fim.split('T')[0].split('-').map(Number);
            const startDate = new Date(sParts[0], sParts[1] - 1, sParts[2]).getTime();
            const endDate = new Date(eParts[0], eParts[1] - 1, eParts[2], 23, 59, 59).getTime();

            return (startDate <= lastDayOfMonth && endDate >= firstDayOfMonth);
        });
    };

    const getSdiasForDay = (month: number, day: number): Sdia[] => {
        return sdias.filter(s => {
            const checkDate = new Date(selectedYear, month, day).getTime();
            const sParts = s.data_inicio.split('T')[0].split('-').map(Number);
            const eParts = s.data_fim.split('T')[0].split('-').map(Number);
            const startDate = new Date(sParts[0], sParts[1] - 1, sParts[2]).getTime();
            const endDate = new Date(eParts[0], eParts[1] - 1, eParts[2]).getTime();
            return checkDate >= startDate && checkDate <= endDate;
        });
    };

    const getHeatmapDataForMonth = (month: number): { day: number, hasImpact: boolean }[] => {
        const data: { day: number, hasImpact: boolean }[] = [];
        const daysInMonth = new Date(selectedYear, month + 1, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            const daySdias = getSdiasForDay(month, day);
            if (daySdias.length > 0) {
                const hasImpact = daySdias.some(s => s.impacto);
                data.push({ day, hasImpact });
            }
        }
        return data;
    };

    const getStartDayOfMonth = (month: number): number => {
        return new Date(selectedYear, month, 1).getDay();
    };

    const getDaysInMonth = (month: number): number => {
        return new Date(selectedYear, month + 1, 0).getDate();
    };

    const handleSaveSdia = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingSdia) {
                const { error } = await supabase
                    .from('sdia')
                    .update(formData)
                    .eq('id', editingSdia.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('sdia')
                    .insert([formData]);
                if (error) throw error;
            }
            setIsFormOpen(false);
            setEditingSdia(null);
            fetchSdias(selectedYear);
        } catch (error) {
            console.error('Error saving SDIA:', error);
            alert('Erro ao salvar SDIA');
        }
    };

    const handleEditSdia = (sdia: Sdia) => {
        setEditingSdia(sdia);
        setFormData(sdia);
        setIsFormOpen(true);
    };

    const handleCloneSdia = (sdia: Sdia) => {
        setEditingSdia(null);
        const { id, created_at, ...cloneData } = sdia;
        setFormData(cloneData);
        setIsFormOpen(true);
    };

    const confirmDelete = async () => {
        if (!sdiaToDelete) return;
        const { error } = await supabase
            .from('sdia')
            .delete()
            .eq('id', sdiaToDelete.id);
        if (!error) {
            fetchSdias(selectedYear);
            setSdiaToDelete(null);
        }
    };

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-[#0d141b] dark:text-white text-3xl font-black tracking-tight">Gerenciamento de SDIA</h1>
                    <p className="text-[#4c739a] dark:text-slate-400">Controle e análise de Solicitações de Divulgação de Informações Aeronáuticas.</p>
                </div>
                <div className="flex gap-3 items-center">
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="px-4 py-3 w-[100px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold focus:ring-2 focus:ring-primary"
                    >
                        {availableYears.map(year => (
                            <option key={year} value={year}>{year}</option>
                        ))}
                    </select>
                    <button 
                        onClick={() => {
                            setEditingSdia(null);
                            setFormData({
                                titulo_sdia: '',
                                indicativo: '',
                                tipo: '',
                                nr_sdia: '',
                                nr_solicitacao: '',
                                descricao: '',
                                analise: '',
                                impacto: false,
                                analista: '',
                                data_inicio: new Date().toISOString().split('T')[0],
                                data_fim: new Date().toISOString().split('T')[0]
                            });
                            setIsFormOpen(true);
                        }}
                        className="px-6 py-3 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined">add</span>
                        <span>Cadastrar Nova SDIA</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {monthNames.map((month, index) => (
                    <div 
                        key={month}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-[#e7edf3] dark:border-slate-800 p-5 shadow-sm cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all"
                        onClick={() => { setSelectedMonth(index); setIsMonthPopupOpen(true); }}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-800 dark:text-white">{month}</h3>
                                {getSdiasForMonth(index).length > 0 && (
                                    <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full">
                                        {getSdiasForMonth(index).length} {getSdiasForMonth(index).length === 1 ? 'SDIA' : 'SDIAs'}
                                    </span>
                                )}
                            </div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{selectedYear}</span>
                        </div>
                        <div className="grid grid-cols-7 gap-1 mb-2">
                            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                                <div key={i} className="text-center text-[10px] font-bold text-slate-400">{d}</div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {Array.from({ length: getStartDayOfMonth(index) }).map((_, i) => (
                                <div key={`empty-${i}`} className="aspect-square"></div>
                            ))}
                            {Array.from({ length: getDaysInMonth(index) }).map((_, i) => {
                                const day = i + 1;
                                const daySdias = getSdiasForDay(index, day);
                                let bgClass = "bg-slate-50 dark:bg-slate-800 text-[#0d141b] dark:text-white";
                                if (daySdias.length > 0) {
                                    bgClass = daySdias.some(s => s.impacto) ? "bg-red-500 text-white" : "bg-green-500 text-white";
                                }
                                return (
                                    <div key={day} className={`aspect-square flex items-center justify-center text-xs font-bold rounded-sm ${bgClass}`}>
                                        {day}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6">
                <div className="text-sm font-bold text-slate-500 uppercase tracking-widest">Legenda de Impacto:</div>
                <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                        <div className="size-4 bg-red-500 rounded"></div>
                        <span className="text-xs font-medium dark:text-slate-300">Com Impacto</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="size-4 bg-green-500 rounded"></div>
                        <span className="text-xs font-medium dark:text-slate-300">Sem Impacto</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="size-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded"></div>
                        <span className="text-xs font-medium dark:text-slate-300">Sem SDIA</span>
                    </div>
                </div>
            </div>

            {/* Month Popup Modal */}
            {isMonthPopupOpen && selectedMonth !== null && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsMonthPopupOpen(false)}>
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-auto" onClick={e => e.stopPropagation()}>
                        <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                                {monthNames[selectedMonth]} {selectedYear}
                            </h2>
                            <button onClick={() => setIsMonthPopupOpen(false)} className="size-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                <span className="material-symbols-outlined text-slate-500">close</span>
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="mb-8">
                                <div className="grid grid-cols-7 gap-3 mb-3">
                                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, i) => (
                                        <div key={i} className="text-center text-xs font-bold text-slate-400 uppercase">{d}</div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-7 gap-3">
                                    {Array.from({ length: getStartDayOfMonth(selectedMonth) }).map((_, i) => (
                                        <div key={`empty-${i}`} className="aspect-square"></div>
                                    ))}
                                    {Array.from({ length: getDaysInMonth(selectedMonth) }).map((_, i) => {
                                        const day = i + 1;
                                        const daySdias = getSdiasForDay(selectedMonth, day);
                                        let bgClass = "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-white";
                                        if (daySdias.length > 0) {
                                            bgClass = daySdias.some(s => s.impacto) ? "bg-red-500 text-white" : "bg-green-500 text-white";
                                        }

                                        return (
                                            <div key={day} className={`aspect-square flex items-center justify-center text-base font-bold rounded-xl ${bgClass} relative cursor-pointer hover:ring-2 hover:ring-primary transition-all group`}>
                                                {day}
                                                {daySdias.length > 0 && (
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity z-[70] pointer-events-none">
                                                        <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
                                                            {daySdias.map(s => (
                                                                <div key={s.id} className="flex items-center gap-2">
                                                                    <span className="font-semibold">{s.indicativo}</span>
                                                                    <span className={s.impacto ? 'text-red-400' : 'text-green-400'}>
                                                                        - {s.impacto ? 'Com Impacto' : 'Sem Impacto'}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">SDIAs do Mês</h3>
                                {getSdiasForMonth(selectedMonth).length === 0 ? (
                                    <p className="text-slate-500 text-center py-8">Nenhuma SDIA neste mês</p>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-200 dark:border-slate-700">
                                                    <th className="text-left py-3 px-2 font-bold text-slate-500 uppercase text-xs">Indicativo</th>
                                                    <th className="text-left py-3 px-2 font-bold text-slate-500 uppercase text-xs">Título</th>
                                                    <th className="text-left py-3 px-2 font-bold text-slate-500 uppercase text-xs">Período</th>
                                                    <th className="text-left py-3 px-2 font-bold text-slate-500 uppercase text-xs">Impacto</th>
                                                    <th className="text-left py-3 px-2 font-bold text-slate-500 uppercase text-xs">Analista</th>
                                                    <th className="text-left py-3 px-2 font-bold text-slate-500 uppercase text-xs">Ações</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {getSdiasForMonth(selectedMonth).map(sdia => (
                                                    <tr key={sdia.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                        <td className="py-3 px-2 font-bold text-slate-800 dark:text-white">{sdia.indicativo}</td>
                                                        <td className="py-3 px-2 text-slate-600 dark:text-slate-400">{sdia.titulo_sdia}</td>
                                                        <td className="py-3 px-2 text-slate-600 dark:text-slate-400">
                                                            {formatDateString(sdia.data_inicio)} - {formatDateString(sdia.data_fim)}
                                                        </td>
                                                        <td className="py-3 px-2">
                                                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${sdia.impacto ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                                {sdia.impacto ? 'COM IMPACTO' : 'SEM IMPACTO'}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-2 text-slate-600 dark:text-slate-400">
                                                            {getAnalystName(sdia.analista)}
                                                        </td>
                                                        <td className="py-3 px-2">
                                                            <div className="flex gap-1">
                                                                <button onClick={() => handleEditSdia(sdia)} className="size-8 flex items-center justify-center rounded-lg hover:bg-primary/10 text-primary transition-colors">
                                                                    <span className="material-symbols-outlined text-lg">edit</span>
                                                                </button>
                                                                <button onClick={() => handleCloneSdia(sdia)} className="size-8 flex items-center justify-center rounded-lg hover:bg-indigo-50 text-indigo-500 transition-colors">
                                                                    <span className="material-symbols-outlined text-lg">content_copy</span>
                                                                </button>
                                                                <button onClick={() => setSdiaToDelete(sdia)} className="size-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Form Modal */}
            {isFormOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full my-8">
                        <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <h2 className="text-xl font-black text-slate-900 dark:text-white">
                                {editingSdia ? 'Editar SDIA' : 'Nova SDIA'}
                            </h2>
                            <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
                        </div>
                        <form onSubmit={handleSaveSdia} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Título da SDIA</label>
                                    <input 
                                        type="text" required
                                        value={formData.titulo_sdia}
                                        onChange={e => setFormData({...formData, titulo_sdia: e.target.value})}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Indicativo</label>
                                    <input 
                                        type="text" required
                                        value={formData.indicativo}
                                        onChange={e => setFormData({...formData, indicativo: e.target.value})}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Tipo</label>
                                    <input 
                                        type="text" required
                                        value={formData.tipo}
                                        onChange={e => setFormData({...formData, tipo: e.target.value})}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nº SDIA</label>
                                    <input 
                                        type="text" required
                                        value={formData.nr_sdia}
                                        onChange={e => setFormData({...formData, nr_sdia: e.target.value})}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Nº Solicitação</label>
                                    <input 
                                        type="text" required
                                        value={formData.nr_solicitacao}
                                        onChange={e => setFormData({...formData, nr_solicitacao: e.target.value})}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Data Início</label>
                                    <input 
                                        type="date" required
                                        value={formData.data_inicio}
                                        onChange={e => setFormData({...formData, data_inicio: e.target.value})}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Data Fim</label>
                                    <input 
                                        type="date" required
                                        value={formData.data_fim}
                                        onChange={e => setFormData({...formData, data_fim: e.target.value})}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Analista</label>
                                    <select 
                                        required
                                        value={formData.analista}
                                        onChange={e => setFormData({...formData, analista: e.target.value})}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary"
                                    >
                                        <option value="">Selecione um analista</option>
                                        {members.map(m => (
                                            <option key={m.id} value={m.id}>{m.abrev} {m.war_name || m.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Descrição</label>
                                    <textarea 
                                        rows={3}
                                        value={formData.descricao}
                                        onChange={e => setFormData({...formData, descricao: e.target.value})}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary"
                                    ></textarea>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Análise</label>
                                    <textarea 
                                        rows={3}
                                        value={formData.analise}
                                        onChange={e => setFormData({...formData, analise: e.target.value})}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary"
                                    ></textarea>
                                </div>
                                <div className="md:col-span-2">
                                    <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <input 
                                            type="checkbox" id="impacto"
                                            checked={formData.impacto}
                                            onChange={e => setFormData({...formData, impacto: e.target.checked})}
                                            className="size-5 rounded border-slate-300 text-primary focus:ring-primary"
                                        />
                                        <label htmlFor="impacto" className="text-sm font-black text-slate-700 dark:text-white cursor-pointer select-none">
                                            Apresenta Impacto Operacional?
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <button 
                                    type="button" onClick={() => setIsFormOpen(false)}
                                    className="flex-1 py-4 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit"
                                    className="flex-1 py-4 rounded-xl bg-primary text-white font-bold shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all active:scale-95"
                                >
                                    {editingSdia ? 'Salvar Alterações' : 'Cadastrar SDIA'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {sdiaToDelete && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden scale-100 animate-in zoom-in-95 duration-200">
                        <div className="p-8 flex flex-col items-center text-center">
                            <div className="size-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6">
                                <span className="material-symbols-outlined text-3xl text-red-500">delete</span>
                            </div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">Confirmar Exclusão</h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-8">
                                Tem certeza que deseja deletar a SDIA <strong className="text-slate-800 dark:text-white">{sdiaToDelete.indicativo}</strong>? <br/>
                                Esta ação não pode ser desfeita.
                            </p>
                            <div className="flex gap-3 w-full">
                                <button 
                                    onClick={() => setSdiaToDelete(null)}
                                    className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    onClick={confirmDelete}
                                    className="flex-1 py-3 rounded-xl bg-red-500 font-bold text-white hover:bg-red-600 shadow-lg shadow-red-500/30 transition-colors"
                                >
                                    Excluir Registro
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SdiaPage;
