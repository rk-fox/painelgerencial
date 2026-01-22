import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

interface Member {
    id: string;
    avatar: string;
    name: string;
    abrev: string;
    war_name: string;
}

interface Category {
    id: string;
    nome_cat: string;
}

interface Task {
    id: string;
    name: string;
    specialties: string[];
    description: string;
    periodicity: string;
    start_date: string;
    end_date: string | null;
    assigned_to: string | null;
    status: string;
    recurrence_active: boolean;
    created_at: string;
    quantidade?: number;
    category?: string;
}

const TaskForm: React.FC = () => {
    const navigate = useNavigate();
    const [view, setView] = useState<'list' | 'form'>('list');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Data
    const [tasks, setTasks] = useState<Task[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
    const [filterSpecialties, setFilterSpecialties] = useState<string[]>([]);
    const [filterPeriodicities, setFilterPeriodicities] = useState<string[]>([]);

    // Category State
    const [categories, setCategories] = useState<Category[]>([]);
    const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    // Form State
    const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        specialties: [] as string[],
        description: '',
        periodicity: 'diaria',
        start_date: '',
        end_date: '',
        assigned_to: '',
    });

    // Rank Definitions
    // Rank Definitions
    const rankOrder: Record<string, number> = {
        // Officers - Value < 4
        'MAJ': 1, 'MAJ.': 1, 'Maj': 1, 'Maj.': 1,
        'CAP': 2, 'CAP.': 2, 'Cap': 2, 'Cap.': 2,
        'TEN': 3, 'TEN.': 3, 'Ten': 3, 'Ten.': 3,
        '1TEN': 3, '1TEN.': 3, '1º Ten': 3,
        '2TEN': 3, '2TEN.': 3, '2º Ten': 3,
        'ASP': 3, 'ASP.': 3, 'Asp': 3,
        // Suboficial and Enlisted - Value >= 4
        'SO': 4, 'SO.': 4, 'S.O': 4,
        '1S': 5, '2S': 5, '3S': 5, 'SGT': 5,
        'CB': 6, 'SD': 7
    };

    useEffect(() => {
        const userJson = localStorage.getItem('currentUser');
        if (userJson) {
            setCurrentUser(JSON.parse(userJson));
        }
        fetchMembers();
        fetchMembers();
        fetchTasks();
        fetchCategories();
    }, []);

    const fetchMembers = async () => {
        try {
            const { data, error } = await supabase
                .from('members')
                //.select('id, name, rank, war_name')
                .select('id, name, avatar, abrev, war_name')
                .order('name');
            if (error) throw error;
            setMembers(data || []);
        } catch (err) {
            console.error('Error fetching members:', err);
        }
    };

    const fetchCategories = async () => {
        try {
            const { data, error } = await supabase
                .from('task_cat')
                .select('*')
                .order('nome_cat');
            if (error) throw error;
            setCategories(data || []);
        } catch (err) {
            console.error('Error fetching categories:', err);
        }
    };

    const fetchTasks = async () => {
        try {
            const { data, error } = await supabase
                .from('tasks')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            setTasks(data || []);
        } catch (err: any) {
            console.error('Error fetching tasks:', err.message);
        }
    };

    // FORM HANDLERS
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

    const handleCreateNew = () => {
        setEditingTask(null);
        setFormData({
            name: '',
            category: '',
            specialties: [],
            description: '',
            periodicity: 'diaria',
            start_date: new Date().toISOString().split('T')[0],
            end_date: '',
            assigned_to: '',
        });
        setView('form');
        setError(null);
    };

    const handleEdit = (task: Task) => {
        setEditingTask(task);
        setFormData({
            name: task.name,
            category: task.category || '',
            specialties: task.specialties || [],
            description: task.description || '',
            periodicity: task.periodicity,
            start_date: task.start_date ? task.start_date.split('T')[0] : '',
            end_date: task.end_date ? task.end_date.split('T')[0] : '',
            assigned_to: task.assigned_to || '',
        });
        setView('form');
        setError(null);
    };

    const handleClone = (task: Task) => {
        // Clone is like create but with prepopulated data (except ID and dates usually reset or kept? User said "Allows editing dates")
        // We set editingTask to null so it inserts as new
        setEditingTask(null);
        setFormData({
            name: `${task.name}`,
            category: task.category || '',
            specialties: task.specialties || [],
            description: task.description || '',
            periodicity: task.periodicity,
            start_date: new Date().toISOString().split('T')[0], // Reset start date to today
            end_date: '',
            assigned_to: '', // Clear assignment for new clone? Usually safer.
        });
        setView('form');
        setError(null);
    };

    const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, category: e.target.value }));
    };

    const handleSaveNewCategory = async () => {
        if (!newCategoryName.trim()) return;

        try {
            const { data, error } = await supabase
                .from('task_cat')
                .insert([{ nome_cat: newCategoryName }])
                .select()
                .single();

            if (error) throw error;

            // Add to list and select it
            setCategories(prev => [...prev, data].sort((a, b) => a.nome_cat.localeCompare(b.nome_cat)));
            setFormData(prev => ({ ...prev, category: newCategoryName })); // Or data.nome_cat
            setShowNewCategoryModal(false);
            setNewCategoryName('');
        } catch (err: any) {
            alert('Erro ao criar categoria: ' + err.message);
        }
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

        const recurrenceActive = ['diaria', 'semanal', 'mensal'].includes(formData.periodicity);

        try {
            const payload = {
                name: formData.name,
                category: formData.category,
                description: formData.description,
                specialties: formData.specialties,
                periodicity: formData.periodicity,
                start_date: formData.start_date,
                end_date: formData.periodicity === 'pontual' ? formData.end_date : null,
                assigned_to: formData.assigned_to || null,
                recurrence_active: recurrenceActive,
                // If creating new, default status to 'pendente'. If editing, keep status unless logic dictates otherwise.
                status: editingTask ? undefined : 'pendente'
            };

            if (editingTask && editingTask.id) {
                // Update
                const { error: updateError } = await supabase
                    .from('tasks')
                    .update(payload)
                    .eq('id', editingTask.id);
                if (updateError) throw updateError;
            } else {
                // Insert
                const { error: insertError } = await supabase
                    .from('tasks')
                    .insert([payload]);
                if (insertError) throw insertError;
            }

            await fetchTasks();
            setView('list');
        } catch (err: any) {
            console.error('Error saving task:', err.message);
            setError('Erro ao salvar tarefa: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Modal States
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);

    // LIST ACTIONS
    const handleDelete = (task: Task) => {
        setTaskToDelete(task);
    };

    const confirmDelete = async () => {
        if (!taskToDelete) return;

        try {
            const { error } = await supabase.from('tasks').delete().eq('id', taskToDelete.id);
            if (error) throw error;
            setTasks(prev => prev.filter(t => t.id !== taskToDelete.id));
            setTaskToDelete(null);
        } catch (err: any) {
            alert('Erro ao apagar: ' + err.message);
        }
    };

    const handleToggleRecurrence = async (task: Task) => {
        try {
            const { error } = await supabase
                .from('tasks')
                .update({ recurrence_active: !task.recurrence_active })
                .eq('id', task.id);
            if (error) throw error;

            setTasks(prev => prev.map(t =>
                t.id === task.id ? { ...t, recurrence_active: !task.recurrence_active } : t
            ));
        } catch (err: any) {
            alert('Erro ao alterar recorrência: ' + err.message);
        }
    };

    // HELPERS
    const canDelete = () => {
        if (!currentUser) return false;
        const rankValue = rankOrder[currentUser.abrev] || 99;
        return rankValue <= 3; // Major(1) to SO(5)
    };

    const getMemberName = (id: string | null) => {
        if (!id) return 'Banco de Tarefas';
        const member = members.find(m => m.id === id);
        return member ? member.name : 'Desconhecido';
    };

    const formatPeriodicity = (p: string) => {
        const map: any = {
            'diaria': 'Diária',
            'semanal': 'Semanal',
            'mensal': 'Mensal',
            'temporada': 'Temporada',
            'pontual': 'Pontual'
        };
        return map[p] || p;
    };

    const getStatusLabel = (s: string) => {
        const map: any = {
            'pendente': 'Pendente',
            'iniciada': 'Em Andamento',
            //'pausada': 'Pausada',
            'concluida': 'Concluída'
        };
        return map[s] || s;
    };

    const getStatusStyle = (s: string) => {
        switch (s) {
            case 'concluida': return 'bg-green-100 text-green-700';
            case 'iniciada': return 'bg-blue-100 text-blue-700';
            //case 'pausada': return 'bg-amber-100 text-amber-700';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    const getTaskHighlight = (task: Task) => {
        if (task.status === 'concluida' || !task.end_date) return '';

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Parse YYYY-MM-DD strictly to local midnight
        const [y, m, d] = task.end_date.split('-').map(Number);
        const endDate = new Date(y, m - 1, d);

        // Difference in days
        const diffTime = endDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Use ceil to be safe, though setHours makes it exact usually

        if (diffDays < 0) {
            // Overdue (< 0)
            return 'bg-red-50 text-red-600 px-2 py-0.5 rounded';
        } else if (diffDays <= 1) {
            // Due Today (0) or Tomorrow (1) - "Intersection 0-1"
            return 'bg-amber-300 text-amber-800 px-2 py-0.5 rounded';
        } else if (diffDays <= 3) {
            // Upcoming (2, 3) - "Yellow 1-3" (excluding 1 as it falls in bucket above)
            return 'bg-amber-100 text-amber-600 px-2 py-0.5 rounded';
        }

        return '';
    };

    // FILTERING
    const filteredTasks = tasks.filter(task => {
        const matchesSearch = task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (task.description || '').toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = filterStatuses.length === 0 || filterStatuses.includes(task.status);
        const matchesSpecialty = filterSpecialties.length === 0 || task.specialties?.some(s => filterSpecialties.includes(s));
        const matchesPeriodicity = filterPeriodicities.length === 0 || filterPeriodicities.includes(task.periodicity);

        return matchesSearch && matchesStatus && matchesSpecialty && matchesPeriodicity;
    });

    if (view === 'form') {
        // FORM VIEW
        return (
            <div className="max-w-4xl mx-auto flex flex-col gap-8 animate-in fade-in duration-500">
                <div className="flex flex-col gap-2">
                    <h1 className="text-[#0d141b] dark:text-white text-3xl font-extrabold leading-tight tracking-tight">
                        {editingTask ? 'Editar Tarefa' : 'Cadastrar Nova Tarefa'}
                    </h1>
                    <p className="text-[#4c739a] dark:text-slate-400 text-base font-normal">
                        Preencha os dados abaixo para {editingTask ? 'atualizar a' : 'criar uma nova'} atividade técnica.
                    </p>
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
                                <div className="flex flex-col gap-2 col-span-2">
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
                                    <label className="text-[#0d141b] dark:text-white text-sm font-semibold">Categoria</label>
                                    <div className="flex gap-2">
                                        <select
                                            name="category"
                                            value={formData.category}
                                            onChange={handleCategoryChange}
                                            className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3"
                                        >
                                            <option value="">Selecione uma categoria...</option>
                                            {categories.map(cat => (
                                                <option key={cat.id} value={cat.nome_cat}>
                                                    {cat.nome_cat}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => setShowNewCategoryModal(true)}
                                            className="h-[46px] w-[50px] flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#4c739a] border border-[#cfdbe7] dark:border-slate-700 transition-colors"
                                            title="Nova Categoria"
                                        >
                                            <span className="material-symbols-outlined text-[24px]">add</span>
                                        </button>
                                    </div>
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
                                onClick={() => setView('list')}
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
                {/* New Category Modal (Form View) */}
                {showNewCategoryModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-[#e7edf3] dark:border-slate-800 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-4 flex flex-col gap-3">
                                <h3 className="text-sm font-bold text-[#0d141b] dark:text-white uppercase tracking-wider">Nova Categoria</h3>
                                <div className="flex gap-2">
                                    <input
                                        autoFocus
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        className="flex-1 rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-[#f8fafc] dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-2"
                                        placeholder="Nome da categoria..."
                                        type="text"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleSaveNewCategory();
                                            if (e.key === 'Escape') setShowNewCategoryModal(false);
                                        }}
                                    />
                                    <button
                                        onClick={handleSaveNewCategory}
                                        disabled={!newCategoryName.trim()}
                                        className="p-2 rounded-lg bg-green-500 hover:bg-green-600 text-white shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Confirmar"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">check</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowNewCategoryModal(false);
                                            setNewCategoryName('');
                                        }}
                                        className="p-2 rounded-lg bg-red-500 hover:bg-red-600 text-white shadow-md transition-all active:scale-95"
                                        title="Cancelar"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">close</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // LIST VIEW
    return (
        <div className="max-w-6xl mx-auto flex flex-col gap-8 animate-in fade-in duration-500">

            {/* Personnel Control Section */}
            <div className="flex flex-col gap-4">
                <h1 className="text-[#0d141b] dark:text-white text-3xl font-extrabold leading-tight tracking-tight">Controle do Efetivo</h1>
                <p className="text-[#4c739a] dark:text-slate-400 text-base font-normal">Tarefas atribuídas ao efetivo nesse momento.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {members
                        .filter(m => {
                            const val = rankOrder[m.abrev] || 99;
                            return val >= 4; // Suboficial (4) and below (>=4)
                        })
                        .map(member => {
                            // Get member tasks
                            const memberTasks = tasks.filter(t => t.assigned_to === member.id && t.status !== 'concluida');
                            // Sort: In Progress first
                            memberTasks.sort((a, b) => {
                                if (a.status === 'iniciada' && b.status !== 'iniciada') return -1;
                                if (a.status !== 'iniciada' && b.status === 'iniciada') return 1;
                                return 0;
                            });

                            return (
                                <div key={member.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-[#e7edf3] dark:border-slate-800 shadow-sm flex flex-col gap-3">
                                    <div className="flex flex-col items-center gap-2 mb-1">
                                        <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[#4c739a] font-bold text-sm uppercase overflow-hidden shadow-sm">
                                            {/* Avatar or Initials */}
                                            {member.avatar ? (
                                                <img
                                                    src={member.avatar}
                                                    alt={member.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                member.name.substring(0, 2)
                                            )}
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <span className="text-lg font-bold text-[#0d141b] dark:text-white leading-tight">
                                                {member.abrev} {member.war_name}
                                            </span>
                                            <span className="text-[10px] text-[#4c739a] font-medium uppercase mt-0.5">
                                                {memberTasks.length} Atividades
                                            </span>
                                        </div>
                                    </div>

                                    <div className="h-px bg-[#e7edf3] dark:bg-slate-800 w-full"></div>

                                    <div className="flex flex-col gap-1.5 min-h-[60px]">
                                        {memberTasks.length > 0 ? (
                                            memberTasks.slice(0, 3).map(task => ( // Show top 3? User didn't specify limit but 4 cols might get tall. Let's show all or scroll? List of tasks... "a lista de tarefas". Let's show all but careful with height.
                                                <div key={task.id} className={`text-xs truncate py-0.5 ${task.status === 'iniciada' ? 'font-bold text-primary' : 'text-[#4c739a]'}`}>
                                                    {task.status === 'iniciada' && '▶ '}
                                                    {task.name}
                                                </div>
                                            ))
                                        ) : (
                                            <span className="text-[10px] text-slate-400 italic">Sem tarefas atribuídas</span>
                                        )}
                                        {memberTasks.length > 3 && (
                                            <span className="text-[10px] text-slate-400 font-medium">+ {memberTasks.length - 3} outras...</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-[#0d141b] dark:text-white text-3xl font-extrabold leading-tight tracking-tight">Gerenciamento de Tarefas</h1>
                    <p className="text-[#4c739a] dark:text-slate-400 text-base font-normal">Gerencie todas as atividades, filtre por especialidade e controle recorrências.</p>
                </div>
                <button
                    onClick={handleCreateNew}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95"
                >
                    <span className="material-symbols-outlined">add</span>
                    Nova Tarefa
                </button>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#e7edf3] dark:border-slate-800 shadow-sm p-4 flex flex-col gap-4">
                {/* Search Bar */}
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por nome, graduação ou especialidade..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                    />
                </div>

                {/* Filters Row */}
                <div className="flex flex-wrap items-center gap-3 md:gap-6 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    {/* Specialties */}
                    <div className="flex items-center gap-2">
                        {['BCT', 'AIS'].map(spec => (
                            <button
                                key={spec}
                                onClick={() => {
                                    setFilterSpecialties(prev =>
                                        prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]
                                    );
                                }}
                                className={`
                                    px-4 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap
                                    ${filterSpecialties.includes(spec)
                                        ? 'bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400'
                                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                                    }
                                `}
                            >
                                {spec}
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden md:block"></div>

                    {/* Periodicities */}
                    <div className="flex items-center gap-2">
                        {[
                            { id: 'diaria', label: 'Diária' },
                            { id: 'semanal', label: 'Semanal' },
                            { id: 'mensal', label: 'Mensal' },
                            { id: 'temporada', label: 'Temporada' },
                            { id: 'pontual', label: 'Pontual' }
                        ].map(period => (
                            <button
                                key={period.id}
                                onClick={() => {
                                    setFilterPeriodicities(prev =>
                                        prev.includes(period.id) ? prev.filter(p => p !== period.id) : [...prev, period.id]
                                    );
                                }}
                                className={`
                                    px-4 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap
                                    ${filterPeriodicities.includes(period.id)
                                        ? 'bg-white border-primary text-primary shadow-sm dark:bg-slate-800 dark:border-primary dark:text-primary'
                                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                                    }
                                `}
                            >
                                {period.label}
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden md:block"></div>

                    {/* Statuses */}
                    <div className="flex items-center gap-2">
                        {[
                            { id: 'pendente', label: 'Pendente' },
                            { id: 'iniciada', label: 'Em Andamento' },
                            { id: 'concluida', label: 'Concluída' },
                            // { id: 'pausada', label: 'Pausada' }
                        ].map(status => (
                            <button
                                key={status.id}
                                onClick={() => {
                                    setFilterStatuses(prev =>
                                        prev.includes(status.id) ? prev.filter(s => s !== status.id) : [...prev, status.id]
                                    );
                                }}
                                className={`
                                    px-4 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap
                                    ${filterStatuses.includes(status.id)
                                        ? 'bg-slate-800 border-slate-800 text-white dark:bg-white dark:border-white dark:text-slate-900'
                                        : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                                    }
                                `}
                            >
                                {status.label}
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden md:block"></div>

                    {/* Reset Button */}
                    <button
                        onClick={() => {
                            setFilterSpecialties([]);
                            setFilterPeriodicities([]);
                            setFilterStatuses([]);
                            setSearchTerm('');
                        }}
                        className="px-4 py-1.5 rounded-full text-xs font-bold bg-primary text-white hover:bg-primary/90 transition-colors shadow-md shadow-primary/20 flex items-center gap-1 whitespace-nowrap"
                    >
                        Todas
                        <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-[#e7edf3] dark:border-slate-800 text-[#4c739a] dark:text-slate-400 text-xs uppercase tracking-wider">
                                <th className="p-4 font-bold">Nome</th>
                                <th className="p-4 font-bold">Periodicidade</th>
                                <th className="p-4 font-bold">Início</th>
                                <th className="p-4 font-bold">Membro</th>
                                <th className="p-4 font-bold">Status</th>
                                <th className="p-4 font-bold text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e7edf3] dark:divide-slate-800">
                            {filteredTasks.length > 0 ? (
                                filteredTasks.map(task => (
                                    <tr key={task.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="p-4">
                                            <p className={`text-sm font-bold text-[#0d141b] dark:text-white inline-block ${getTaskHighlight(task)}`}>{task.name}</p>
                                            <div className="flex gap-1 mt-1">
                                                {task.specialties?.map(s => (
                                                    <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[#4c739a] font-bold">{s}</span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-[#4c739a] dark:text-slate-300">
                                            {formatPeriodicity(task.periodicity)}
                                            {task.recurrence_active && (
                                                <span className="ml-1 text-[10px] text-green-600 font-bold" title="Recorrência Ativa">↺</span>
                                            )}
                                            {!task.recurrence_active && ['diaria', 'semanal', 'mensal'].includes(task.periodicity) && (
                                                <span className="ml-1 text-[10px] text-red-400 font-bold" title="Recorrência Parada">✕</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-sm text-[#4c739a] dark:text-slate-300">
                                            {task.start_date ? task.start_date.split('T')[0].split('-').reverse().join('/') : '-'}
                                        </td>
                                        <td className="p-4 text-sm text-[#4c739a] dark:text-slate-300">
                                            {getMemberName(task.assigned_to)}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusStyle(task.status)}`}>
                                                {getStatusLabel(task.status)}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEdit(task)}
                                                    className="p-2 text-[#4c739a] hover:bg-white hover:text-primary dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-[#e7edf3] hover:shadow-sm"
                                                    title="Editar"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">edit</span>
                                                </button>
                                                <button
                                                    onClick={() => handleClone(task)}
                                                    className="p-2 text-[#4c739a] hover:bg-white hover:text-blue-600 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-[#e7edf3] hover:shadow-sm"
                                                    title="Clonar"
                                                >
                                                    <span className="material-symbols-outlined text-[18px]">content_copy</span>
                                                </button>
                                                {task.recurrence_active && (
                                                    <button
                                                        onClick={() => handleToggleRecurrence(task)}
                                                        className="p-2 text-[#4c739a] hover:bg-white hover:text-amber-600 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-[#e7edf3] hover:shadow-sm"
                                                        title="Interromper Recorrência"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">event_busy</span>
                                                    </button>
                                                )}
                                                {!task.recurrence_active && ['diaria', 'semanal', 'mensal'].includes(task.periodicity) && (
                                                    <button
                                                        onClick={() => handleToggleRecurrence(task)}
                                                        className="p-2 text-[#4c739a] hover:bg-white hover:text-green-600 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-[#e7edf3] hover:shadow-sm"
                                                        title="Ativar Recorrência"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">update</span>
                                                    </button>
                                                )}
                                                {canDelete() && (
                                                    <button
                                                        onClick={() => handleDelete(task)}
                                                        className="p-2 text-[#4c739a] hover:bg-red-100 hover:text-red-600 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-[#e7edf3] hover:shadow-sm"
                                                    >
                                                        <span className="material-symbols-outlined text-[16px]">delete</span>
                                                    </button>)}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-[#4c739a] text-sm italic">
                                        Nenhuma tarefa encontrada com os filtros atuais.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Delete Confirmation Modal */}
            {taskToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-[#e7edf3] dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 text-center">
                            <div className="size-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-red-500 text-[32px]">delete_forever</span>
                            </div>
                            <h3 className="text-xl font-bold text-[#0d141b] dark:text-white mb-2">Confirmar Exclusão</h3>
                            <p className="text-[#4c739a] dark:text-slate-400">
                                Tem certeza que deseja deletar a tarefa <span className="font-bold text-[#0d141b] dark:text-white">"{taskToDelete.name}"</span>?
                                <br />Esta ação não pode ser desfeita.
                            </p>
                        </div>
                        <div className="flex p-4 gap-3 bg-[#f8fafc] dark:bg-slate-800/50">
                            <button
                                onClick={() => setTaskToDelete(null)}
                                className="flex-1 px-4 py-3 rounded-xl border border-[#cfdbe7] dark:border-slate-700 text-sm font-bold text-[#4c739a] hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold shadow-lg shadow-red-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                disabled={loading}
                            >
                                {loading ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                                ) : (
                                    'Excluir Registro'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default TaskForm;