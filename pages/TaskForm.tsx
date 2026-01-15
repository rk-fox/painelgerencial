import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

interface Member {
    id: string;
    name: string;
}

const TaskForm: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [members, setMembers] = useState<Member[]>([]);

    const [formData, setFormData] = useState({
        name: '',
        specialties: [] as string[],
        description: '',
        periodicity: 'diaria',
        start_date: '',
        end_date: '',
        assigned_to: '',
    });

    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const { data, error } = await supabase
                    .from('members')
                    .select('id, name')
                    .order('name');

                if (error) throw error;
                setMembers(data || []);
            } catch (err) {
                console.error('Error fetching members:', err);
            }
        };

        fetchMembers();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSpecialtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = e.target;
        setFormData(prev => {
            const newSpecialties = checked
                ? [...prev.specialties, value]
                : prev.specialties.filter(s => s !== value);
            return { ...prev, specialties: newSpecialties };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Validation for Pontual
        if (formData.periodicity === 'pontual' && !formData.end_date) {
            setError('A data de conclusão é obrigatória para tarefas pontuais.');
            setLoading(false);
            return;
        }

        try {
            const { error: insertError } = await supabase
                .from('tasks')
                .insert([{
                    name: formData.name,
                    description: formData.description,
                    specialties: formData.specialties,
                    periodicity: formData.periodicity,
                    start_date: formData.start_date,
                    end_date: formData.periodicity === 'pontual' ? formData.end_date : null,
                    assigned_to: formData.assigned_to || null
                }]);

            if (insertError) throw insertError;

            navigate('/app/dashboard');
        } catch (err: any) {
            console.error('Error saving task:', err.message);
            setError('Erro ao cadastrar tarefa: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto flex flex-col gap-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-2">
                <h1 className="text-[#0d141b] dark:text-white text-3xl font-extrabold leading-tight tracking-tight">Cadastrar Nova Tarefa</h1>
                <p className="text-[#4c739a] dark:text-slate-400 text-base font-normal">Preencha os dados abaixo para criar uma nova atividade técnica para a equipe BCT ou AIS.</p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#e7edf3] dark:border-slate-800 shadow-sm overflow-hidden">
                <form className="flex flex-col" onSubmit={handleSubmit}>
                    <div className="p-6 border-b border-[#e7edf3] dark:border-slate-800">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col gap-2 col-span-2 md:col-span-1">
                                <label className="text-[#0d141b] dark:text-white text-sm font-semibold">Nome da Tarefa</label>
                                <input
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3"
                                    placeholder="Ex: Monitoramento de Capacidade de Setor"
                                    type="text"
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-2 col-span-2 md:col-span-1">
                                <label className="text-[#0d141b] dark:text-white text-sm font-semibold">Especialidade Requerida</label>
                                <div className="flex gap-2">
                                    <label className="flex-1 cursor-pointer">
                                        <input
                                            className="hidden peer"
                                            type="checkbox"
                                            value="BCT"
                                            checked={formData.specialties.includes('BCT')}
                                            onChange={handleSpecialtyChange}
                                        />
                                        <div className="text-center p-3 rounded-lg border border-[#cfdbe7] dark:border-slate-700 peer-checked:bg-primary/10 peer-checked:border-primary peer-checked:text-primary transition-all text-sm font-medium active:scale-95">BCT</div>
                                    </label>
                                    <label className="flex-1 cursor-pointer">
                                        <input
                                            className="hidden peer"
                                            type="checkbox"
                                            value="AIS"
                                            checked={formData.specialties.includes('AIS')}
                                            onChange={handleSpecialtyChange}
                                        />
                                        <div className="text-center p-3 rounded-lg border border-[#cfdbe7] dark:border-slate-700 peer-checked:bg-primary/10 peer-checked:border-primary peer-checked:text-primary transition-all text-sm font-medium active:scale-95">AIS</div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 border-b border-[#e7edf3] dark:border-slate-800">
                        <div className="flex flex-col gap-2">
                            <label className="text-[#0d141b] dark:text-white text-sm font-semibold">Descrição detalhada</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                className="w-full min-h-32 rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3 resize-none"
                                placeholder="Descreva as etapas, objetivos e requisitos técnicos da tarefa..."
                            ></textarea>
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50/50 dark:bg-slate-800/20">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-[#0d141b] dark:text-white text-sm font-semibold">Periodicidade</label>
                                <select
                                    name="periodicity"
                                    value={formData.periodicity}
                                    onChange={handleInputChange}
                                    className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3"
                                >
                                    <option value="diaria">Diária</option>
                                    <option value="semanal">Semanal</option>
                                    <option value="mensal">Mensal</option>
                                    <option value="temporada">Temporada</option>
                                    <option value="pontual">Pontual</option>
                                </select>
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[#0d141b] dark:text-white text-sm font-semibold">Data de Início</label>
                                <div className="relative">
                                    <input
                                        name="start_date"
                                        value={formData.start_date}
                                        onChange={handleInputChange}
                                        className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3 pl-10"
                                        type="date"
                                        required
                                    />
                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#4c739a] pointer-events-none text-xl">calendar_today</span>
                                </div>
                            </div>


                            <div className="flex flex-col gap-2">
                                <label className="text-[#0d141b] dark:text-white text-sm font-semibold">Membro Designado (Opcional)</label>
                                <select
                                    name="assigned_to"
                                    value={formData.assigned_to}
                                    onChange={handleInputChange}
                                    className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3"
                                >
                                    <option value="">Em branco (Banco de Tarefas)</option>
                                    {members.map(member => (
                                        <option key={member.id} value={member.id}>
                                            {member.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {formData.periodicity === 'pontual' && (
                                <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <label className="text-[#0d141b] dark:text-white text-sm font-semibold">Prazo de Conclusão</label>
                                    <div className="relative">
                                        <input
                                            name="end_date"
                                            value={formData.end_date}
                                            onChange={handleInputChange}
                                            className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3 pl-10"
                                            type="date"
                                        />
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#4c739a] pointer-events-none text-xl">event_available</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-6 border-t border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end gap-3">
                        <button
                            className="px-6 py-2.5 rounded-lg border border-[#cfdbe7] dark:border-slate-700 text-[#0d141b] dark:text-white text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            type="button"
                            onClick={() => navigate('/app/dashboard')}
                        >
                            Cancelar
                        </button>
                        <button
                            className="px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-bold shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                            type="submit"
                            disabled={loading}
                        >
                            {loading && <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>}
                            {loading ? 'Salvando...' : 'Salvar Tarefa'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl">
                    <span className="material-symbols-outlined text-blue-600">info</span>
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-bold text-blue-900 dark:text-blue-200">Definição de Especialidade</p>
                        <p className="text-xs text-blue-800/80 dark:text-blue-300">Tarefas BCT focam no controle operacional. Tarefas AIS focam no gerenciamento de informação aeronáutica.</p>
                    </div>
                </div>
                <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl">
                    <span className="material-symbols-outlined text-amber-600">notification_important</span>
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Prazos e SLAs</p>
                        <p className="text-xs text-amber-800/80 dark:text-amber-300">A data de início deve ser igual ou superior à data atual. Notificações automáticas serão enviadas à equipe.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskForm;