import React, { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "../supabase";
import {
    compareMembersByRank,
    getAuthenticatedUserProfile,
} from "../utils/permissions";

interface Member {
    id: string;
    name: string;
    war_name: string;
    rank?: string;
    abrev?: string;
    avatar?: string;
    status?: string;
    sector?: string;
    specialty?: string;
}

interface Meeting {
    id: string;
    assunto: string;
    detalhes?: string | null;
    inicio: string;
    fim: string;
    link?: string | null;
    membros?: string[];
    sector?: string;
    created_at?: string;
}

const MONTH_NAMES = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
];

const WEEKDAY_NAMES = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

const Meetings: React.FC = () => {
    // Current User & Sector
    const [currentUser, setCurrentUser] = useState<any>(() => {
        const userJson = localStorage.getItem("currentUser");
        return userJson ? JSON.parse(userJson) : null;
    });

    const userSector = currentUser?.sector || "SE";

    // CH Sector Filter Toggle: Ambos | Capacidade | Espaço Aéreo
    const [selectedSectorFilter, setSelectedSectorFilter] = useState<
        "Ambos" | "Capacidade" | "Espaço Aéreo"
    >("Ambos");

    // View Mode: 'agenda' (Monthly Calendar) vs 'table' (List)
    const [viewMode, setViewMode] = useState<"agenda" | "table">("agenda");

    // Calendar Navigation Anchor Date
    const [anchorDate, setAnchorDate] = useState<Date>(new Date());
    const currentMonth = anchorDate.getMonth();
    const currentYear = anchorDate.getFullYear();

    // Data States
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [allMembers, setAllMembers] = useState<Member[]>([]);
    const [meetingAvailableMembers, setMeetingAvailableMembers] = useState<Member[]>([]);
    const [memberSectorMap, setMemberSectorMap] = useState<Map<string, string>>(new Map());
    const [loading, setLoading] = useState<boolean>(true);
    const [searchTerm, setSearchTerm] = useState<string>("");

    // Table Sorting State: 'assunto' | 'inicio' | 'fim'
    const [sortField, setSortField] = useState<"assunto" | "inicio" | "fim">("inicio");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

    // Modal State
    const [showMeetingModal, setShowMeetingModal] = useState<boolean>(false);
    const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
    const [meetingData, setMeetingData] = useState({
        assunto: "",
        detalhes: "",
        inicio: "",
        fim: "",
        link: "",
    });
    const [meetingMembers, setMeetingMembers] = useState<string[]>([]);
    const [memberFilterSearch, setMemberFilterSearch] = useState<string>("");

    // Delete Confirmation Modal
    const [meetingToDelete, setMeetingToDelete] = useState<Meeting | null>(null);
    const [isSaving, setIsSaving] = useState<boolean>(false);

    // Initial Load & Auth Sync
    useEffect(() => {
        const init = async () => {
            try {
                const profile = await getAuthenticatedUserProfile();
                if (profile) {
                    setCurrentUser(profile);
                }
            } catch (err) {
                console.error("Error fetching user profile:", err);
            }
            await fetchMembers();
            await fetchMeetings();
            setLoading(false);
        };
        init();
    }, []);

    // Fetch Members & Build Sector Map
    const fetchMembers = async () => {
        try {
            const { data, error } = await supabase
                .from("members")
                .select("id, name, war_name, rank, abrev, avatar, status, sector, specialty")
                .order("name");

            if (error) throw error;

            const membersList: Member[] = data || [];
            setAllMembers(membersList);

            // Build Map of memberId -> sector
            const secMap = new Map<string, string>();
            membersList.forEach((m) => {
                if (m.sector) secMap.set(m.id, m.sector);
            });
            setMemberSectorMap(secMap);

            // Filter CP, EA and CH members available for meeting assignments
            const meetingMembersList = membersList
                .filter((m) => m.sector === "CP" || m.sector === "EA" || m.sector === "CH")
                .sort(compareMembersByRank);
            setMeetingAvailableMembers(meetingMembersList);
        } catch (err: any) {
            console.error("Error fetching members:", err.message);
        }
    };

    // Fetch All Meetings
    const fetchMeetings = async () => {
        try {
            const { data, error } = await supabase
                .from("meeting")
                .select("*")
                .order("inicio", { ascending: false });

            if (error) throw error;
            setMeetings(data || []);
        } catch (err: any) {
            console.error("Error fetching meetings:", err.message);
        }
    };

    // Filter Meetings by Sector and Search
    const filteredMeetings = useMemo(() => {
        let list = meetings;

        if (userSector === "CH") {
            if (selectedSectorFilter === "Capacidade") {
                list = list.filter((m) => {
                    if (m.sector === "CP" || m.sector === "CH") return true;
                    return m.membros?.some((id: string) => {
                        const sec = memberSectorMap.get(id);
                        return sec === "CP" || sec === "CH";
                    });
                });
            } else if (selectedSectorFilter === "Espaço Aéreo") {
                list = list.filter((m) => {
                    if (m.sector === "EA" || m.sector === "CH") return true;
                    return m.membros?.some((id: string) => {
                        const sec = memberSectorMap.get(id);
                        return sec === "EA" || sec === "CH";
                    });
                });
            }
        } else {
            list = list.filter((m) => {
                if (m.sector === userSector || m.sector === "CH") return true;
                return m.membros?.some((id: string) => memberSectorMap.get(id) === userSector);
            });
        }

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            list = list.filter((m) => {
                const matchAssunto = m.assunto?.toLowerCase().includes(term);
                const matchDetalhes = m.detalhes?.toLowerCase().includes(term);
                const matchMembers = m.membros?.some((id: string) => {
                    const mem = allMembers.find((item) => item.id === id);
                    return (
                        mem?.name?.toLowerCase().includes(term) ||
                        mem?.war_name?.toLowerCase().includes(term) ||
                        mem?.rank?.toLowerCase().includes(term)
                    );
                });
                return matchAssunto || matchDetalhes || matchMembers;
            });
        }

        return list;
    }, [meetings, userSector, selectedSectorFilter, memberSectorMap, searchTerm, allMembers]);

    // Handle Table Column Sorting
    const handleSort = (field: "assunto" | "inicio" | "fim") => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
            setSortField(field);
            // Default to ascending for assunto (A-Z), descending for dates (most recent first)
            setSortDirection(field === "assunto" ? "asc" : "desc");
        }
    };

    // Sorted Meetings for Table View
    const sortedTableMeetings = useMemo(() => {
        const list = [...filteredMeetings];
        list.sort((a, b) => {
            if (sortField === "assunto") {
                const comp = (a.assunto || "").localeCompare(b.assunto || "", "pt-BR", {
                    sensitivity: "base",
                });
                return sortDirection === "asc" ? comp : -comp;
            } else if (sortField === "inicio") {
                const timeA = a.inicio ? new Date(a.inicio).getTime() : 0;
                const timeB = b.inicio ? new Date(b.inicio).getTime() : 0;
                return sortDirection === "asc" ? timeA - timeB : timeB - timeA;
            } else if (sortField === "fim") {
                const timeA = a.fim ? new Date(a.fim).getTime() : 0;
                const timeB = b.fim ? new Date(b.fim).getTime() : 0;
                return sortDirection === "asc" ? timeA - timeB : timeB - timeA;
            }
            return 0;
        });
        return list;
    }, [filteredMeetings, sortField, sortDirection]);

    // Calendar Navigation Helpers
    const handlePrevMonth = () => {
        setAnchorDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setAnchorDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    };

    const handleTodayMonth = () => {
        setAnchorDate(new Date());
    };

    const getDaysInMonth = (year: number, month: number) =>
        new Date(year, month + 1, 0).getDate();

    const getFirstDayOfMonth = (year: number, month: number) =>
        new Date(year, month, 1).getDay();

    // Meetings scheduled on a specific day of the currently viewed month
    const getMeetingsForDay = (day: number) => {
        return filteredMeetings
            .filter((m) => {
                if (!m.inicio) return false;
                const d = new Date(m.inicio);
                return (
                    d.getFullYear() === currentYear &&
                    d.getMonth() === currentMonth &&
                    d.getDate() === day
                );
            })
            .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
    };

    // Format helper for HH:mm
    const formatTime = (isoString: string) => {
        if (!isoString) return "";
        try {
            const d = new Date(isoString);
            return d.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return "";
        }
    };

    // Open Modal for New Meeting (Optionally prefilling a date)
    const handleOpenNewMeeting = (prefillDate?: Date) => {
        setEditingMeetingId(null);
        let startStr = "";
        let endStr = "";

        if (prefillDate) {
            const pad = (n: number) => String(n).padStart(2, "0");
            const y = prefillDate.getFullYear();
            const m = pad(prefillDate.getMonth() + 1);
            const d = pad(prefillDate.getDate());
            startStr = `${y}-${m}-${d}T09:00`;
            endStr = `${y}-${m}-${d}T10:00`;
        } else {
            const now = new Date();
            now.setMinutes(0, 0, 0);
            now.setHours(now.getHours() + 1);
            const pad = (n: number) => String(n).padStart(2, "0");
            startStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:00`;
            const end = new Date(now.getTime() + 60 * 60 * 1000);
            endStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:00`;
        }

        setMeetingData({
            assunto: "",
            detalhes: "",
            inicio: startStr,
            fim: endStr,
            link: "",
        });
        setMeetingMembers(currentUser?.id ? [currentUser.id] : []);
        setMemberFilterSearch("");
        setShowMeetingModal(true);
    };

    const handleEditMeeting = (meeting: Meeting) => {
        setEditingMeetingId(meeting.id);
        setMeetingData({
            assunto: meeting.assunto,
            detalhes: meeting.detalhes || "",
            inicio: meeting.inicio ? meeting.inicio.slice(0, 16) : "",
            fim: meeting.fim ? meeting.fim.slice(0, 16) : "",
            link: meeting.link || "",
        });
        setMeetingMembers(meeting.membros || []);
        setMemberFilterSearch("");
        setShowMeetingModal(true);
    };

    const handleCloneMeeting = (meeting: Meeting) => {
        setEditingMeetingId(null);
        setMeetingData({
            assunto: `Cópia: ${meeting.assunto}`,
            detalhes: meeting.detalhes || "",
            inicio: meeting.inicio ? meeting.inicio.slice(0, 16) : "",
            fim: meeting.fim ? meeting.fim.slice(0, 16) : "",
            link: meeting.link || "",
        });
        setMeetingMembers(meeting.membros || []);
        setMemberFilterSearch("");
        setShowMeetingModal(true);
    };

    const handleDeleteMeeting = (meeting: Meeting) => {
        setMeetingToDelete(meeting);
    };

    const confirmDeleteMeeting = useCallback(async () => {
        if (!meetingToDelete) return;
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from("meeting")
                .delete()
                .eq("id", meetingToDelete.id);

            if (error) throw error;
            await fetchMeetings();
            setMeetingToDelete(null);
        } catch (err: any) {
            console.error("Error deleting meeting:", err.message);
            alert("Erro ao excluir reunião: " + err.message);
        } finally {
            setIsSaving(false);
        }
    }, [meetingToDelete]);

    // Keyboard navigation for Delete modal
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (meetingToDelete) {
                if (e.key === "Enter") {
                    confirmDeleteMeeting();
                } else if (e.key === "Escape") {
                    setMeetingToDelete(null);
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [meetingToDelete, confirmDeleteMeeting]);

    // Save/Update Meeting
    const handleScheduleMeeting = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const payload: any = {
                assunto: meetingData.assunto,
                detalhes: meetingData.detalhes || null,
                inicio: new Date(meetingData.inicio).toISOString(),
                fim: new Date(meetingData.fim).toISOString(),
                link: meetingData.link || null,
                membros: meetingMembers,
            };

            if (editingMeetingId) {
                const { error: updateError } = await supabase
                    .from("meeting")
                    .update(payload)
                    .eq("id", editingMeetingId);
                if (updateError) throw updateError;
            } else {
                const { error: insertError } = await supabase
                    .from("meeting")
                    .insert([payload]);
                if (insertError) throw insertError;
            }

            setShowMeetingModal(false);
            setMeetingData({ assunto: "", detalhes: "", inicio: "", fim: "", link: "" });
            setMeetingMembers([]);
            setEditingMeetingId(null);
            await fetchMeetings();
        } catch (err: any) {
            console.error("Error saving meeting:", err.message);
            alert("Erro ao salvar reunião: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    // Filter available members in modal by member search input
    const modalFilteredMembers = useMemo(() => {
        if (!memberFilterSearch.trim()) return meetingAvailableMembers;
        const term = memberFilterSearch.toLowerCase();
        return meetingAvailableMembers.filter(
            (m) =>
                m.name?.toLowerCase().includes(term) ||
                m.war_name?.toLowerCase().includes(term) ||
                m.rank?.toLowerCase().includes(term) ||
                m.sector?.toLowerCase().includes(term)
        );
    }, [meetingAvailableMembers, memberFilterSearch]);

    // Today comparison helper
    const isToday = (day: number) => {
        const today = new Date();
        return (
            today.getFullYear() === currentYear &&
            today.getMonth() === currentMonth &&
            today.getDate() === day
        );
    };

    return (
        <div className="flex flex-col gap-6 w-full max-w-[1400px] mx-auto pb-12 animate-in fade-in duration-300">
            {/* Top Header Card */}
            <div className="bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-800 rounded-2xl p-4 md:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[28px]">event</span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl md:text-3xl font-black text-[#0d141b] dark:text-white tracking-tight">
                                Reuniões
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
                                {filteredMeetings.length}
                            </span>
                        </div>
                        <p className="text-sm text-[#4c739a] dark:text-slate-400 font-medium">
                            {userSector === "CP"
                                ? "Agenda de reuniões da Seção de Capacidade ATC."
                                : userSector === "EA"
                                ? "Agenda de reuniões da Seção de Espaço Aéreo."
                                : userSector === "CH"
                                ? "Agenda de reuniões da Subdivisão Estratégica."
                                : `Agenda de reuniões${userSector ? ` ${userSector}` : ""}.`}
                        </p>
                    </div>
                </div>

                {/* Header Controls */}
                <div className="flex flex-wrap items-center gap-3">
                    {/* CH Sector Filter Toggle */}
                    {userSector === "CH" && (
                        <div className="flex bg-slate-100 dark:bg-[#132039] border border-slate-200 dark:border-[#1d2d44] p-1 rounded-xl shadow-inner">
                            <button
                                type="button"
                                onClick={() => setSelectedSectorFilter("Ambos")}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all uppercase tracking-wider ${
                                    selectedSectorFilter === "Ambos"
                                        ? "bg-white dark:bg-slate-700 text-primary dark:text-[#cda250] shadow-sm"
                                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                                title="Visualizar todos os setores (CP + EA + CH)"
                            >
                                Ambos
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedSectorFilter("Capacidade")}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all uppercase tracking-wider ${
                                    selectedSectorFilter === "Capacidade"
                                        ? "bg-white dark:bg-slate-700 text-primary dark:text-[#cda250] shadow-sm"
                                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                                title="Visualizar Capacidade e Chefia (CP + CH)"
                            >
                                Capacidade
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedSectorFilter("Espaço Aéreo")}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all uppercase tracking-wider ${
                                    selectedSectorFilter === "Espaço Aéreo"
                                        ? "bg-white dark:bg-slate-700 text-primary dark:text-[#cda250] shadow-sm"
                                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                                title="Visualizar Espaço Aéreo e Chefia (EA + CH)"
                            >
                                Espaço Aéreo
                            </button>
                        </div>
                    )}

                    {/* View Switcher: Agenda vs Tabela */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
                        <button
                            type="button"
                            onClick={() => setViewMode("agenda")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                viewMode === "agenda"
                                    ? "bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm"
                                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                            }`}
                        >
                            <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                            Ver Agenda
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("table")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                viewMode === "table"
                                    ? "bg-white dark:bg-slate-700 text-primary dark:text-white shadow-sm"
                                    : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                            }`}
                        >
                            <span className="material-symbols-outlined text-[18px]">table_rows</span>
                            Lista
                        </button>
                    </div>

                    {/* Agendar Reunião Button */}
                    <button
                        type="button"
                        onClick={() => handleOpenNewMeeting()}
                        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-2 px-5 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95 whitespace-nowrap text-sm"
                    >
                        <span className="material-symbols-outlined text-[20px]">add</span>
                        Agendar Reunião
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {viewMode === "agenda" ? (
                /* ========================================================================= */
                /* MODE: AGENDA MENSAL (Baseado no layout do MonthlyPlanner)                */
                /* ========================================================================= */
                <div className="bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-800 rounded-2xl shadow-sm flex flex-col overflow-hidden">
                    {/* Month Header Navigation Bar */}
                    <div className="p-4 md:p-6 border-b border-[#e7edf3] dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/30">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center bg-white dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-800 rounded-xl overflow-hidden shadow-sm shrink-0">
                                <button
                                    type="button"
                                    onClick={handlePrevMonth}
                                    className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-[#4c739a] hover:text-primary transition-colors border-r border-[#e7edf3] dark:border-slate-800"
                                    title="Mês anterior"
                                >
                                    <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                                </button>
                                <div className="px-5 py-2 min-w-[170px] text-center">
                                    <span className="text-base md:text-lg font-black text-[#0d141b] dark:text-white capitalize whitespace-nowrap">
                                        {MONTH_NAMES[currentMonth]} {currentYear}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleNextMonth}
                                    className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-[#4c739a] hover:text-primary transition-colors border-l border-[#e7edf3] dark:border-slate-800"
                                    title="Próximo mês"
                                >
                                    <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={handleTodayMonth}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-[#e7edf3] dark:border-slate-700 text-[#4c739a] hover:text-primary hover:bg-white dark:hover:bg-slate-800 transition-all shadow-sm"
                            >
                                Hoje
                            </button>
                        </div>

                        {/* Search in Agenda */}
                        <div className="relative w-full md:w-64">
                            <span className="material-symbols-outlined absolute left-3 top-2.5 text-[#4c739a] text-[18px]">
                                search
                            </span>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Filtrar reuniões..."
                                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:ring-primary focus:border-primary text-[#0d141b] dark:text-white placeholder-[#4c739a]"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm("")}
                                    className="absolute right-2.5 top-2 text-[#4c739a] hover:text-slate-700"
                                >
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Calendar Grid Container with Responsive Horizontal Scroll */}
                    <div className="overflow-x-auto custom-scrollbar">
                        <div className="min-w-[950px]">
                            {/* Days of Week Header */}
                            <div className="grid grid-cols-7 border-b border-[#e7edf3] dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40">
                                {WEEKDAY_NAMES.map((day) => (
                                    <div
                                        key={day}
                                        className="py-3 text-center text-xs font-black text-[#5c85ad] dark:text-slate-400 uppercase tracking-widest"
                                    >
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Days Matrix */}
                            <div className="grid grid-cols-7 auto-rows-fr bg-[#e7edf3] dark:bg-slate-800 gap-[1px]">
                                {/* Empty offset slots */}
                                {Array.from({ length: getFirstDayOfMonth(currentYear, currentMonth) }).map((_, i) => (
                                    <div
                                        key={`empty-${i}`}
                                        className="min-h-[140px] bg-slate-50/40 dark:bg-slate-950/30 p-2"
                                    />
                                ))}

                                {/* Day Cells */}
                                {Array.from({ length: getDaysInMonth(currentYear, currentMonth) }).map((_, i) => {
                                    const day = i + 1;
                                    const dayMeetings = getMeetingsForDay(day);
                                    const currentIsToday = isToday(day);

                                    return (
                                        <div
                                            key={`day-${day}`}
                                            className={`min-h-[140px] p-2 transition-colors flex flex-col group relative ${
                                                currentIsToday
                                                    ? "bg-amber-50/30 dark:bg-amber-950/10"
                                                    : "bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-850"
                                            }`}
                                        >
                                            {/* Day Header */}
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span
                                                    className={`inline-flex items-center justify-center size-7 rounded-full text-xs font-black ${
                                                        currentIsToday
                                                            ? "bg-primary text-white shadow-md shadow-primary/30"
                                                            : "text-[#0d141b] dark:text-slate-300 group-hover:text-primary"
                                                    }`}
                                                >
                                                    {day}
                                                </span>

                                                {/* Add meeting on this day button */}
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleOpenNewMeeting(
                                                            new Date(currentYear, currentMonth, day)
                                                        )
                                                    }
                                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-[#4c739a] hover:text-primary transition-all text-xs"
                                                    title="Agendar neste dia"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">add</span>
                                                </button>
                                            </div>

                                            {/* Scheduled Meetings List on this Day */}
                                            <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto max-h-[180px] custom-scrollbar pr-0.5">
                                                {dayMeetings.map((m) => {
                                                    const hasLink = !!m.link;
                                                    return (
                                                        <div
                                                            key={m.id}
                                                            onClick={() => handleEditMeeting(m)}
                                                            className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/40 hover:border-amber-400 dark:hover:border-amber-600 transition-all cursor-pointer shadow-xs hover:shadow-md flex flex-col gap-1 text-left group/card"
                                                        >
                                                            {/* Time and Link Badge */}
                                                            <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                                                                <span className="flex items-center gap-1 font-mono">
                                                                    <span className="material-symbols-outlined text-[13px]">
                                                                        schedule
                                                                    </span>
                                                                    {formatTime(m.inicio)} - {formatTime(m.fim)}
                                                                </span>
                                                                {hasLink && (
                                                                    <a
                                                                        href={m.link!}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="text-primary hover:text-primary/80 transition-colors p-0.5"
                                                                        title="Abrir Link da Reunião"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[14px]">
                                                                            link
                                                                        </span>
                                                                    </a>
                                                                )}
                                                            </div>

                                                            {/* Assunto */}
                                                            <div className="font-extrabold text-xs text-slate-900 dark:text-slate-100 line-clamp-2 leading-tight group-hover/card:text-primary">
                                                                {m.assunto}
                                                            </div>

                                                            {/* Attendees snippet */}
                                                            {m.membros && m.membros.length > 0 && (
                                                                <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                                                    <span className="material-symbols-outlined text-[12px]">
                                                                        groups
                                                                    </span>
                                                                    <span>
                                                                        {m.membros.length} convocado{m.membros.length > 1 ? "s" : ""}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* ========================================================================= */
                /* MODE: TABELA (Lista de Reuniões migrada de TaskForm)                      */
                /* ========================================================================= */
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-[#e7edf3] dark:border-slate-800 shadow-sm p-4 md:p-6 flex flex-col gap-4">
                    {/* Table Filters & Search */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="relative flex-1 max-w-md">
                            <span className="material-symbols-outlined absolute left-3 top-3 text-[#4c739a] text-[20px]">
                                search
                            </span>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar por assunto, detalhes ou convocado..."
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary text-[#0d141b] dark:text-white"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm("")}
                                    className="absolute right-3 top-2.5 text-[#4c739a] hover:text-slate-700"
                                >
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                            )}
                        </div>

                        <div className="text-xs font-bold text-[#4c739a]">
                            Exibindo <span className="text-primary">{filteredMeetings.length}</span> reunião(ões)
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[850px]">
                            <thead>
                                <tr className="border-b-2 border-[#e7edf3] dark:border-slate-800 text-[#4c739a] dark:text-slate-400 text-[10px] uppercase font-black tracking-widest">
                                    <th
                                        onClick={() => handleSort("assunto")}
                                        className="py-4 px-4 cursor-pointer select-none group/th hover:text-primary transition-colors"
                                        title="Clique para ordenar por Assunto"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span>Assunto & Pauta</span>
                                            <span
                                                className={`material-symbols-outlined text-[16px] transition-all ${
                                                    sortField === "assunto"
                                                        ? "text-primary opacity-100"
                                                        : "text-slate-400 dark:text-slate-500 opacity-0 group-hover/th:opacity-100"
                                                }`}
                                            >
                                                {sortField === "assunto"
                                                    ? sortDirection === "asc"
                                                        ? "arrow_upward"
                                                        : "arrow_downward"
                                                    : "unfold_more"}
                                            </span>
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort("inicio")}
                                        className="py-4 px-4 cursor-pointer select-none group/th hover:text-primary transition-colors"
                                        title="Clique para ordenar por Início"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span>Início</span>
                                            <span
                                                className={`material-symbols-outlined text-[16px] transition-all ${
                                                    sortField === "inicio"
                                                        ? "text-primary opacity-100"
                                                        : "text-slate-400 dark:text-slate-500 opacity-0 group-hover/th:opacity-100"
                                                }`}
                                            >
                                                {sortField === "inicio"
                                                    ? sortDirection === "asc"
                                                        ? "arrow_upward"
                                                        : "arrow_downward"
                                                    : "unfold_more"}
                                            </span>
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort("fim")}
                                        className="py-4 px-4 cursor-pointer select-none group/th hover:text-primary transition-colors"
                                        title="Clique para ordenar por Fim"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span>Fim</span>
                                            <span
                                                className={`material-symbols-outlined text-[16px] transition-all ${
                                                    sortField === "fim"
                                                        ? "text-primary opacity-100"
                                                        : "text-slate-400 dark:text-slate-500 opacity-0 group-hover/th:opacity-100"
                                                }`}
                                            >
                                                {sortField === "fim"
                                                    ? sortDirection === "asc"
                                                        ? "arrow_upward"
                                                        : "arrow_downward"
                                                    : "unfold_more"}
                                            </span>
                                        </div>
                                    </th>
                                    <th className="py-4 px-4 text-center">Convocados</th>
                                    <th className="py-4 px-4 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#e7edf3] dark:divide-slate-800/50">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-[#4c739a]">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary/30 border-t-primary" />
                                                <span>Carregando reuniões...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : sortedTableMeetings.length > 0 ? (
                                    sortedTableMeetings.map((meeting) => (
                                        <tr
                                            key={meeting.id}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                                        >
                                            <td className="py-4 px-4">
                                                <div className="flex flex-col gap-1 max-w-sm">
                                                    <span className="font-bold text-[#0d141b] dark:text-white text-sm">
                                                        {meeting.assunto}
                                                    </span>
                                                    {meeting.detalhes && (
                                                        <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                                                            {meeting.detalhes}
                                                        </span>
                                                    )}
                                                    {meeting.link && (
                                                        <a
                                                            href={meeting.link}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-primary text-[11px] font-bold hover:underline flex items-center gap-1 mt-0.5"
                                                        >
                                                            <span className="material-symbols-outlined text-[13px]">
                                                                link
                                                            </span>
                                                            Abrir Link da Reunião
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="text-sm text-[#4c739a] dark:text-slate-300 font-medium">
                                                    {new Date(meeting.inicio).toLocaleString("pt-BR", {
                                                        day: "2-digit",
                                                        month: "2-digit",
                                                        year: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="text-sm text-[#4c739a] dark:text-slate-300 font-medium">
                                                    {new Date(meeting.fim).toLocaleString("pt-BR", {
                                                        day: "2-digit",
                                                        month: "2-digit",
                                                        year: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-[#4c739a] dark:text-slate-300 text-[11px] font-bold rounded-full">
                                                    {meeting.membros?.length || 0} Membro(s)
                                                </span>
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => handleEditMeeting(meeting)}
                                                        className="p-1.5 rounded-lg text-[#4c739a] hover:bg-primary/10 hover:text-primary transition-colors"
                                                        title="Editar Reunião"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">
                                                            edit
                                                        </span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleCloneMeeting(meeting)}
                                                        className="p-1.5 rounded-lg text-[#4c739a] hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                                        title="Clonar Reunião"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">
                                                            content_copy
                                                        </span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteMeeting(meeting)}
                                                        className="p-1.5 rounded-lg text-[#4c739a] hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30 transition-colors"
                                                        title="Excluir Reunião"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">
                                                            delete
                                                        </span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="py-12 text-center text-[#4c739a] dark:text-slate-500 text-sm">
                                            Nenhuma reunião encontrada com os filtros selecionados.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL: AGENDAR / EDITAR REUNIÃO                                           */}
            {/* ========================================================================= */}
            {showMeetingModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-[#e7edf3] dark:border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-[#e7edf3] dark:border-slate-800 flex justify-between items-center bg-[#f8fafc] dark:bg-slate-800/50">
                            <h3 className="text-xl font-bold text-[#0d141b] dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">event</span>
                                {editingMeetingId ? "Editar Reunião" : "Agendar Reunião"}
                            </h3>
                            <button
                                onClick={() => {
                                    setShowMeetingModal(false);
                                    setEditingMeetingId(null);
                                    setMeetingMembers([]);
                                }}
                                className="p-1 text-[#4c739a] hover:text-[#0d141b] dark:hover:text-white transition-colors"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        {/* Body Form */}
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                            <form id="meetingFormModal" onSubmit={handleScheduleMeeting} className="flex flex-col gap-4">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                        Assunto <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        value={meetingData.assunto}
                                        onChange={(e) =>
                                            setMeetingData({ ...meetingData, assunto: e.target.value })
                                        }
                                        className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3 text-[#0d141b] dark:text-white"
                                        placeholder="Ex: Reunião de Alinhamento Operacional"
                                    />
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                        Detalhes / Pauta
                                    </label>
                                    <input
                                        type="text"
                                        value={meetingData.detalhes}
                                        onChange={(e) =>
                                            setMeetingData({ ...meetingData, detalhes: e.target.value })
                                        }
                                        className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3 text-[#0d141b] dark:text-white"
                                        placeholder="Ex: Pauta da reunião, pontos de discussão e metas"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                            Início <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            required
                                            type="datetime-local"
                                            value={meetingData.inicio}
                                            onChange={(e) =>
                                                setMeetingData({ ...meetingData, inicio: e.target.value })
                                            }
                                            className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3 text-[#0d141b] dark:text-white"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                            Fim <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            required
                                            type="datetime-local"
                                            value={meetingData.fim}
                                            onChange={(e) =>
                                                setMeetingData({ ...meetingData, fim: e.target.value })
                                            }
                                            className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3 text-[#0d141b] dark:text-white"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                        Link da Reunião (Opcional)
                                    </label>
                                    <input
                                        type="url"
                                        value={meetingData.link}
                                        onChange={(e) =>
                                            setMeetingData({ ...meetingData, link: e.target.value })
                                        }
                                        className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3 text-[#0d141b] dark:text-white"
                                        placeholder="Ex: https://meet.google.com/abc-defg-hij"
                                    />
                                </div>

                                {/* Convocados Section */}
                                <div className="flex flex-col gap-2 mt-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                            Membros Convocados
                                        </label>
                                        <span className="text-xs text-primary font-bold">
                                            {meetingMembers.length} selecionado(s)
                                        </span>
                                    </div>

                                    {/* Quick Selection Buttons */}
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const cpMembers = meetingAvailableMembers
                                                    .filter((m) => m.sector === "CP" || m.sector === "CH")
                                                    .map((m) => m.id);
                                                setMeetingMembers([...new Set([...meetingMembers, ...cpMembers])]);
                                            }}
                                            className="px-3 py-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-bold transition-colors"
                                        >
                                            Capacidade
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                const eaMembers = meetingAvailableMembers
                                                    .filter((m) => m.sector === "EA" || m.sector === "CH")
                                                    .map((m) => m.id);
                                                setMeetingMembers([...new Set([...meetingMembers, ...eaMembers])]);
                                            }}
                                            className="px-3 py-1.5 rounded bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-bold transition-colors"
                                        >
                                            Espaço Aéreo
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMeetingMembers(meetingAvailableMembers.map((m) => m.id));
                                            }}
                                            className="px-3 py-1.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 text-xs font-bold transition-colors"
                                        >
                                            Subdivisão Estratégica
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setMeetingMembers([])}
                                            className="px-3 py-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 text-xs font-bold transition-colors ml-auto"
                                        >
                                            Limpar
                                        </button>
                                    </div>

                                    {/* Member Search input in modal */}
                                    <div className="relative mb-2">
                                        <span className="material-symbols-outlined absolute left-2.5 top-2 text-[#4c739a] text-[16px]">
                                            search
                                        </span>
                                        <input
                                            type="text"
                                            value={memberFilterSearch}
                                            onChange={(e) => setMemberFilterSearch(e.target.value)}
                                            placeholder="Filtrar por nome ou posto..."
                                            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-[#0d141b] dark:text-white"
                                        />
                                    </div>

                                    {/* Member checkboxes list */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-[#e7edf3] dark:border-slate-700 rounded-xl p-3 max-h-48 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-800/30">
                                        {modalFilteredMembers.map((member) => (
                                            <label
                                                key={member.id}
                                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-[#e7edf3] dark:hover:border-slate-700 transition-all cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={meetingMembers.includes(member.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setMeetingMembers([...meetingMembers, member.id]);
                                                        } else {
                                                            setMeetingMembers(
                                                                meetingMembers.filter((id) => id !== member.id)
                                                            );
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                                />
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <img
                                                        src={
                                                            member.avatar ||
                                                            "https://ui-avatars.com/api/?name=" + member.name
                                                        }
                                                        alt={member.name}
                                                        className="w-6 h-6 rounded-full object-cover shrink-0"
                                                    />
                                                    <span className="text-xs font-bold text-[#0d141b] dark:text-slate-300 truncate">
                                                        {member.abrev || member.rank} {member.war_name || member.name}
                                                    </span>
                                                    {member.sector && (
                                                        <span className="text-[10px] text-slate-400 font-semibold uppercase">
                                                            ({member.sector})
                                                        </span>
                                                    )}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </form>
                        </div>

                        {/* Footer */}
                        <div className="flex p-4 gap-3 bg-[#f8fafc] dark:bg-slate-800/50 border-t border-[#e7edf3] dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowMeetingModal(false);
                                    setEditingMeetingId(null);
                                    setMeetingMembers([]);
                                }}
                                className="flex-1 px-4 py-3 rounded-xl border border-[#cfdbe7] dark:border-slate-700 text-sm font-bold text-[#4c739a] hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                form="meetingFormModal"
                                disabled={isSaving}
                                className="flex-1 px-4 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {isSaving ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                                ) : editingMeetingId ? (
                                    "Atualizar"
                                ) : (
                                    "Agendar"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL: CONFIRMAR EXCLUSÃO DE REUNIÃO                                      */}
            {/* ========================================================================= */}
            {meetingToDelete && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-red-100 dark:border-red-900/30 w-full max-w-md p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 text-red-500">
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                                <span className="material-symbols-outlined text-[24px]">delete</span>
                            </div>
                            <h3 className="text-lg font-bold text-[#0d141b] dark:text-white">
                                Excluir Reunião
                            </h3>
                        </div>
                        <p className="text-sm text-[#4c739a] dark:text-slate-400">
                            Tem certeza que deseja excluir permanentemente a reunião{" "}
                            <span className="font-bold text-[#0d141b] dark:text-white">
                                "{meetingToDelete.assunto}"
                            </span>
                            ? Esta ação não pode ser desfeita.
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                            <button
                                type="button"
                                onClick={() => setMeetingToDelete(null)}
                                className="flex-1 px-4 py-2.5 rounded-xl border border-[#cfdbe7] dark:border-slate-700 text-sm font-bold text-[#4c739a] hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                            >
                                Cancelar (Esc)
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteMeeting}
                                disabled={isSaving}
                                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2"
                            >
                                {isSaving ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white" />
                                ) : (
                                    "Excluir (Enter)"
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Meetings;
