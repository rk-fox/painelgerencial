import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Member } from '../types';

const MembersList: React.FC = () => {
    const navigate = useNavigate();
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [memberToDelete, setMemberToDelete] = useState<{ id: string, name: string } | null>(null);

    useEffect(() => {
        fetchMembers();
    }, []);

    const fetchMembers = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('members')
                .select('*')
                .order('name');

            if (error) throw error;
            setMembers(data || []);
        } catch (err: any) {
            console.error('Error fetching members:', err.message);
        } finally {
            setLoading(false);
        }
    };

    const confirmDelete = async () => {
        if (!memberToDelete) return;

        try {
            setLoading(true);
            const { error } = await supabase
                .from('members')
                .delete()
                .eq('id', memberToDelete.id);

            if (error) throw error;
            setMembers(prev => prev.filter(m => m.id !== memberToDelete.id));
            setMemberToDelete(null);
        } catch (err: any) {
            console.error('Error deleting member:', err.message);
            alert('Erro ao deletar membro: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (id: string) => {
        navigate(`/app/members/edit/${id}`);
    };

    const getInitials = (name: string) => {
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                <div className="max-w-2xl">
                    <h2 className="text-[#0d141b] dark:text-white text-3xl font-black leading-tight tracking-[-0.033em]">Gestão de Membros</h2>
                    <p className="text-[#4c739a] dark:text-slate-400 mt-1">Gerencie o cadastro, especialidades e status operacional dos membros da equipe técnica BCT e AIS.</p>
                </div>
                <button
                    onClick={() => navigate('/app/members/new')}
                    className="inline-flex items-center justify-center gap-2 px-6 h-12 bg-primary hover:bg-primary/90 text-white rounded-lg font-bold transition-all shadow-lg shadow-primary/20 whitespace-nowrap"
                >
                    <span className="material-symbols-outlined text-[20px]">person_add</span>
                    Adicionar Novo Membro
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <StatCard title="Total de Equipe" value={members.length.toString()} icon="groups" color="blue" />
                <StatCard title="Membros Ativos" value={members.filter(m => m.status === 'Ativo').length.toString()} icon="check_circle" color="green" />
                <StatCard title="Em Viagem/Missão" value={members.filter(m => m.status === 'Em Viagem').length.toString()} icon="flight" color="amber" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <StatCard title="Especialistas BCT" value={members.filter(m => m.specialty === 'BCT').length.toString()} image="https://raw.githubusercontent.com/rk-fox/painelgerencial/refs/heads/main/bct-icon-transp.png" color="indigo" />
                <StatCard title="Especialistas AIS" value={members.filter(m => m.specialty === 'AIS').length.toString()} image="https://raw.githubusercontent.com/rk-fox/painelgerencial/refs/heads/main/ais-icon-transp.png" color="purple" />
                <StatCard title="Indisponíveis" value={members.filter(m => m.status === 'Indisponível').length.toString()} icon="close" color="red" />
            </div>

            {/* Filters and Search */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-[#e7edf3] dark:border-slate-800 shadow-sm mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#4c739a] group-focus-within:text-primary transition-colors">
                            <span className="material-symbols-outlined text-[22px]">search</span>
                        </div>
                        <input
                            className="w-full bg-[#f8fafc] dark:bg-slate-800 border-none rounded-lg py-3 pl-12 pr-4 text-[#0d141b] dark:text-white placeholder:text-[#4c739a] focus:ring-2 focus:ring-primary/20 transition-all text-sm"
                            placeholder="Buscar por nome, graduação ou especialidade..."
                            type="text"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button className="flex items-center gap-2 px-4 py-3 bg-[#f8fafc] dark:bg-slate-800 text-[#4c739a] dark:text-slate-400 rounded-lg border border-[#e7edf3] dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-95 text-sm font-medium">
                            <span className="material-symbols-outlined text-[20px]">filter_list</span>
                            Filtros
                        </button>
                        <button className="flex items-center gap-2 px-4 py-3 bg-[#f8fafc] dark:bg-slate-800 text-[#4c739a] dark:text-slate-400 rounded-lg border border-[#e7edf3] dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-95 text-sm font-medium">
                            <span className="material-symbols-outlined text-[20px]">download</span>
                            Exportar
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#e7edf3] dark:border-slate-800 shadow-sm overflow-hidden mb-8">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-[#f8fafc] dark:bg-slate-800/50 border-b border-[#e7edf3] dark:border-slate-800">
                                <th className="px-6 py-4 text-xs font-bold text-[#4c739a] dark:text-slate-400 uppercase tracking-wider">Membro</th>
                                <th className="px-6 py-4 text-xs font-bold text-[#4c739a] dark:text-slate-400 uppercase tracking-wider">Graduação</th>
                                <th className="px-6 py-4 text-xs font-bold text-[#4c739a] dark:text-slate-400 uppercase tracking-wider">Especialidade</th>
                                <th className="px-6 py-4 text-xs font-bold text-[#4c739a] dark:text-slate-400 uppercase tracking-wider">Entrada</th>
                                <th className="px-6 py-4 text-xs font-bold text-[#4c739a] dark:text-slate-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-[#4c739a] dark:text-slate-400 uppercase tracking-wider text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e7edf3] dark:divide-slate-800">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                                        <p className="text-sm text-[#4c739a] mt-4">Carregando membros...</p>
                                    </td>
                                </tr>
                            ) : members.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <p className="text-sm text-[#4c739a]">Nenhum membro encontrado.</p>
                                    </td>
                                </tr>
                            ) : (
                                members.map((member) => (
                                    <MemberRow
                                        key={member.id}
                                        initials={getInitials(member.name)}
                                        initialsColor="bg-primary/10 text-primary"
                                        avatar={member.avatar}
                                        name={member.name}
                                        email={member.email}
                                        rank={member.rank}
                                        specialty={member.specialty}
                                        specialtyColor={member.specialty === 'BCT' ? 'blue' : 'amber'}
                                        entry={new Date(member.entry_date).toLocaleDateString('pt-BR')}
                                        status={member.status}
                                        statusColor={member.status === 'Ativo' ? 'green' : member.status === 'Em Viagem' ? 'indigo' : 'red'}
                                        onEdit={() => handleEdit(member.id)}
                                        onDelete={() => setMemberToDelete({ id: member.id, name: member.name })}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="flex items-center justify-between px-6 py-4 border-t border-[#e7edf3] dark:border-slate-800 bg-[#f8fafc] dark:bg-slate-900">
                    <p className="text-sm text-[#4c739a] dark:text-slate-400">Mostrando <span className="font-bold text-[#0d141b] dark:text-white">{members.length}</span> de <span className="font-bold text-[#0d141b] dark:text-white">{members.length}</span> membros</p>
                    <div className="flex items-center gap-2">
                        <button className="px-3 py-1.5 rounded-lg border border-[#cfdbe7] dark:border-slate-700 text-sm font-medium hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50 transition-all active:scale-95" disabled>Anterior</button>
                        <button className="px-3.5 py-1.5 rounded-lg bg-primary text-white text-sm font-bold shadow-sm active:scale-95 transition-all">1</button>
                        <button className="px-3 py-1.5 rounded-lg border border-[#cfdbe7] dark:border-slate-700 text-sm font-medium hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50" disabled>Próximo</button>
                    </div>
                </div>
            </div>

            {/* Custom Confirmation Modal */}
            {memberToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-[#e7edf3] dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 text-center">
                            <div className="size-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-red-500 text-[32px]">delete_forever</span>
                            </div>
                            <h3 className="text-xl font-bold text-[#0d141b] dark:text-white mb-2">Confirmar Exclusão</h3>
                            <p className="text-[#4c739a] dark:text-slate-400">
                                Tem certeza que deseja deletar o registro de <span className="font-bold text-[#0d141b] dark:text-white">{memberToDelete.name}</span>?
                                <br />Esta ação não pode ser desfeita.
                            </p>
                        </div>
                        <div className="flex p-4 gap-3 bg-[#f8fafc] dark:bg-slate-800/50">
                            <button
                                onClick={() => setMemberToDelete(null)}
                                className="flex-1 px-4 py-3 rounded-xl border border-[#cfdbe7] dark:border-slate-700 text-sm font-bold text-[#4c739a] hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-95"
                                disabled={loading}
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

const StatCard = ({ title, value, icon, image, color }: any) => {
    const colors: any = {
        blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600',
        green: 'bg-green-50 dark:bg-green-900/20 text-green-600',
        amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600',
        indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600',
        purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600',
        red: 'bg-red-50 dark:bg-red-900/20 text-red-600',
    };

    return (
        <div className="p-6 bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-800 rounded-xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-[#4c739a] dark:text-slate-400">{title}</p>
                    <p className="text-3xl font-black text-[#0d141b] dark:text-white mt-1">{value}</p>
                </div>
                <div className={`size-12 rounded-xl flex items-center justify-center ${colors[color] || colors.blue}`}>
                    {image ? (
                        <img src={image} alt={title} className="size-10 object-contain" />
                    ) : (
                        <span className="material-symbols-outlined text-[32px]">{icon}</span>
                    )}
                </div>
            </div>
        </div>
    );
};

const MemberRow = ({ initials, initialsColor, avatar, name, email, rank, specialty, specialtyColor, entry, status, statusColor, onEdit, onDelete }: any) => {
    const badges: any = {
        blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
        red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };

    return (
        <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
            <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                    {avatar ? (
                        <img src={avatar} alt={name} className="size-10 rounded-full object-cover border border-slate-200" />
                    ) : (
                        <div className={`size-10 rounded-full flex items-center justify-center font-bold ${initialsColor}`}>{initials}</div>
                    )}
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-[#0d141b] dark:text-white">{name}</span>
                        <span className="text-xs text-[#4c739a]">{email}</span>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4 text-sm text-[#4c739a] dark:text-slate-400">{rank}</td>
            <td className="px-6 py-4">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${badges[specialtyColor]}`}>
                    <img
                        src={specialty === 'BCT' ? 'https://raw.githubusercontent.com/rk-fox/painelgerencial/refs/heads/main/bct-icon-transp.png' : 'https://raw.githubusercontent.com/rk-fox/painelgerencial/refs/heads/main/ais-icon-transp.png'}
                        alt={specialty}
                        className="size-4 object-contain"
                    />
                    {specialty}
                </span>
            </td>
            <td className="px-6 py-4 text-sm text-[#4c739a] dark:text-slate-400">{entry}</td>
            <td className="px-6 py-4">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${badges[statusColor]}`}>
                    <span className={`size-1.5 rounded-full ${statusColor === 'green' ? 'bg-green-600' : statusColor === 'indigo' ? 'bg-indigo-600' : 'bg-red-600'}`}></span> {status}
                </span>
            </td>
            <td className="px-6 py-4 text-right">
                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={onEdit}
                        className="p-2 text-[#4c739a] hover:text-primary transition-all active:scale-95"
                    >
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                    </button>
                    <button
                        onClick={onDelete}
                        className="p-2 text-[#4c739a] hover:text-red-500 transition-all active:scale-95"
                    >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                </div>
            </td>
        </tr>
    );
};

export default MembersList;
