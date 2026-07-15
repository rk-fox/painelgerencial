import React, { useEffect, useState } from "react";
import { supabase } from "../supabase";

const QuadroBranco: React.FC = () => {
    const [tasks, setTasks] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());

    const selectedMonth = selectedDate.getMonth();
    const selectedYear = selectedDate.getFullYear();
    const now = new Date();
    const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();

    const goToPreviousMonth = () => {
        setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const goToNextMonth = () => {
        if (!isCurrentMonth) {
            setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return "-";
        const safeDate = dateString.length === 10 ? `${dateString}T12:00:00` : dateString;
        return new Date(safeDate).toLocaleDateString("pt-BR");
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const userJson = localStorage.getItem("currentUser");
                const sector = userJson ? JSON.parse(userJson).sector : null;

                if (!sector || (sector !== "CP" && sector !== "EA")) {
                    setLoading(false);
                    return;
                }

                // Fetch members
                const { data: membersData } = await supabase
                    .from("members")
                    .select("id, name, war_name, rank, abrev")
                    .eq("sector", sector);

                if (membersData) setMembers(membersData);

                // Fetch tasks for the sector
                const { data: tasksData } = await supabase
                    .from("tasks")
                    .select("*")
                    .eq("sector", sector)
                    .order("created_at", { ascending: false })
                    .limit(5000);

                if (tasksData) setTasks(tasksData);
            } catch (error) {
                console.error("Error fetching Quadro Branco data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const updateObs = async (taskId: string, newObs: string) => {
        try {
            await supabase.from("tasks").update({ obs: newObs }).eq(
                "id",
                taskId,
            );
            setTasks((prev) =>
                prev.map((t) => t.id === taskId ? { ...t, obs: newObs } : t)
            );
        } catch (error) {
            console.error("Error updating obs:", error);
        }
    };

    const rankMap: Record<string, string> = {
        'Major': 'Maj.',
        'Capitão': 'Cap.',
        '1º Tenente': 'Ten.',
        '2º Tenente': 'Ten.',
        'Suboficial': 'SO.',
        '1º Sargento': 'Sgt.',
        '2º Sargento': 'Sgt.',
        '3º Sargento': 'Sgt.',
        'Civil': 'Cv.'
    };

    const getMemberName = (id: string | null) => {
        if (!id) return "N/A";
        const m = members.find((member) => member.id === id);
        if (!m) return "Desconhecido";
        const abbr = m.abrev || rankMap[m.rank] || m.rank || "";
        return `${abbr} ${m.war_name || m.name}`.trim();
    };

    const calculateDaysRemaining = (dateString: string | null) => {
        if (!dateString) return null;
        const safeDate = dateString.length === 10 ? `${dateString}T12:00:00` : dateString;
        const target = new Date(safeDate);
        target.setHours(23, 59, 59, 999);
        const now = new Date();
        const diff = target.getTime() - now.getTime();
        return Math.ceil(diff / (1000 * 3600 * 24));
    };

    const getLatestTask = (head: any) => {
        let current = head;
        while (current.despacho) {
            const child = tasks.find((t) => t.id === current.despacho);
            if (!child) break;
            current = child;
        }
        return current;
    };

    // Find head tasks (tasks that have qb=true and no other task points to them via despacho)
    const headTasks = tasks.filter((t) => {
        if (!t.qb) return false;
        const isChild = tasks.some((other) => other.despacho === t.id);
        if (isChild) return false;

        const latest = getLatestTask(t);
        const taskDateStr = t.start_date || t.created_at;
        const taskDate = taskDateStr ? new Date(taskDateStr.length === 10 ? `${taskDateStr}T12:00:00` : taskDateStr) : new Date();
        
        const taskMonth = taskDate.getMonth();
        const taskYear = taskDate.getFullYear();
        
        const createdInSelectedMonth = taskMonth === selectedMonth && taskYear === selectedYear;
        const createdBeforeSelectedMonth = taskYear < selectedYear || (taskYear === selectedYear && taskMonth < selectedMonth);
        
        if (createdInSelectedMonth) return true;
        if (createdBeforeSelectedMonth && latest.status !== 'concluida') return true;
        
        return false;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary">
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-[#0d141b] dark:text-white flex items-center gap-3">
                        <span className="material-symbols-outlined text-4xl text-primary">
                            view_kanban
                        </span>
                        Quadro Branco
                    </h1>
                    <p className="text-[#4c739a] dark:text-slate-400 mt-2 font-medium">
                        Acompanhamento de tarefas e despachos
                    </p>
                </div>

                <div className="flex items-center justify-between border border-[#e7edf3] dark:border-slate-700 rounded-full px-4 py-2 bg-white dark:bg-slate-800 shadow-sm w-64">
                    <button onClick={goToPreviousMonth} className="text-primary hover:bg-slate-100 dark:hover:bg-slate-700 p-1 rounded-full flex items-center justify-center transition-colors">
                        <span className="material-symbols-outlined">chevron_left</span>
                    </button>
                    <span className="font-bold text-[#0d141b] dark:text-white capitalize">
                        {selectedDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                    </span>
                    <button onClick={goToNextMonth} disabled={isCurrentMonth} className={`p-1 rounded-full flex items-center justify-center transition-colors ${isCurrentMonth ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'text-primary hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                        <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-[#e7edf3] dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-[#0d141b] dark:text-slate-300">
                        <thead className="bg-[#f8fafc] dark:bg-slate-800/50 text-[#4c739a] dark:text-slate-400 uppercase font-bold text-xs">
                            <tr>
                                <th className="px-6 py-4 w-12 text-center">
                                    #
                                </th>
                                <th className="px-6 py-4 whitespace-nowrap">
                                    Início
                                </th>
                                <th className="px-6 py-4 min-w-[200px]">
                                    Tarefa
                                </th>
                                <th className="px-6 py-4 whitespace-nowrap">
                                    Despacho
                                </th>
                                <th className="px-6 py-4 whitespace-nowrap">
                                    Responsável
                                </th>
                                <th className="px-6 py-4 whitespace-nowrap">
                                    Prazo
                                </th>
                                <th className="px-6 py-4 whitespace-nowrap">
                                    Status
                                </th>
                                <th className="px-6 py-4 whitespace-nowrap">
                                    Status Final
                                </th>
                                <th className="px-6 py-4 w-64">Observações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e7edf3] dark:divide-slate-800/60">
                            {headTasks.map((head, idx) => {
                                const latest = getLatestTask(head);
                                const daysRemaining = calculateDaysRemaining(
                                    head.prazo_final,
                                );

                                let deadlineColor = "";
                                if (daysRemaining !== null) {
                                    if (daysRemaining <= 3) {
                                        deadlineColor =
                                            "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 font-bold";
                                    } else if (daysRemaining <= 10) {
                                        deadlineColor =
                                            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 font-bold";
                                    } else {deadlineColor =
                                            "text-[#4c739a] dark:text-slate-400";}
                                }

                                const isDispatched = head.id !== latest.id;
                                const despachoText = isDispatched
                                    ? `Despachado com ${
                                        getMemberName(latest.assigned_to)
                                    }`
                                    : "Em Andamento";

                                return (
                                    <tr
                                        key={head.id}
                                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                    >
                                        <td className="px-6 py-4 text-center text-[#4c739a] font-bold">
                                            {idx + 1}
                                        </td>
                                        <td className="px-6 py-4 text-[#4c739a] dark:text-slate-400">
                                            {formatDate(head.start_date)}
                                        </td>
                                        <td className="px-6 py-4 font-semibold">
                                            {head.name || head.title}
                                        </td>
                                        <td className="px-6 py-4 font-semibold text-primary whitespace-nowrap">
                                            {despachoText}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {getMemberName(head.assigned_to)}
                                        </td>
                                        <td
                                            className={`px-6 py-4 rounded-md whitespace-nowrap ${deadlineColor}`}
                                        >
                                            {formatDate(head.prazo_final)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`px-3 py-1 text-xs font-bold rounded-full uppercase whitespace-nowrap ${
                                                    head.status === "concluida"
                                                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                        : head.status ===
                                                                "iniciada"
                                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                                                }`}
                                            >
                                                {head.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`px-3 py-1 text-xs font-bold rounded-full uppercase whitespace-nowrap ${
                                                    latest.status ===
                                                            "concluida"
                                                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                        : latest.status ===
                                                                "iniciada"
                                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                                                }`}
                                            >
                                                {latest.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="relative group flex items-center min-w-[200px]">
                                                <input
                                                    type="text"
                                                    defaultValue={head.obs ||
                                                        ""}
                                                    onBlur={(e) => {
                                                        if (
                                                            e.target.value !==
                                                                head.obs
                                                        ) {
                                                            updateObs(
                                                                head.id,
                                                                e.target.value,
                                                            );
                                                        }
                                                    }}
                                                    placeholder="Adicionar observação..."
                                                    className="w-full rounded-md border border-transparent hover:border-[#cfdbe7] dark:hover:border-slate-700 focus:border-primary focus:ring-1 focus:ring-primary bg-transparent focus:bg-white dark:focus:bg-slate-800 p-2 pr-8 text-sm transition-all"
                                                />
                                                <span
                                                    className="material-symbols-outlined absolute right-2 text-[#cfdbe7] dark:text-slate-600 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Salva automaticamente ao sair"
                                                >
                                                    save
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {headTasks.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={9}
                                        className="px-6 py-12 text-center text-[#4c739a] dark:text-slate-500"
                                    >
                                        Nenhuma tarefa no Quadro Branco.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default QuadroBranco;
