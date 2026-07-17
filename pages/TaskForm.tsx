import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../supabase";
import { parseLocalDate } from "../utils/dateUtils";

interface Member {
    id: string;
    avatar: string;
    rank: string;
    name: string;
    abrev: string;
    war_name: string;
    status: string;
    sector?: string;
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
    sector?: string;
    quantidade?: number;
    category?: string;
    qb?: boolean;
    despacho?: string | null;
    obs?: string | null;
    prazo_final?: string | null;
}
// Rank Priority Logic
const getRankPriority = (
    rankStr: string | null,
    abrevStr: string | null,
): number => {
    const s = (rankStr || abrevStr || "").toUpperCase().trim();
    if (s.includes("MAJOR") || s.includes("MAJ")) return 0;
    if (s.includes("CAPIT")) return 1;
    if (s.includes("1º TEN") || s.includes("1.º TEN") || s.includes("1TEN")) {
        return 2;
    }
    if (
        s.includes("2º TEN") || s.includes("2.º TEN") || s.includes("2TEN") ||
        s.includes("ASP")
    ) return 3;
    if (s.includes("SUBOF") || s.includes("SO.")) return 4;
    if (s.includes("1º SAR") || s.includes("1.º SAR") || s.includes("1SGT")) {
        return 5;
    }
    if (s.includes("2º SAR") || s.includes("2.º SAR") || s.includes("2SGT")) {
        return 6;
    }
    if (s.includes("3º SAR") || s.includes("3.º SAR") || s.includes("3SGT")) {
        return 7;
    }
    if (s.includes("SGT")) return 7;
    if (s.includes("CIV")) return 8;
    return 99;
};

const TaskForm: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [view, setView] = useState<"list" | "form">("list");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        category: "",
        specialties: ["BCT", "AIS"] as string[],
        description: "",
        periodicity: "",
        start_date: "",
        end_date: "",
        assigned_to: "",
        sector: "",
        qb: false,
        prazo_final: "",
    });

    useEffect(() => {
        if (location.state?.editTask) {
            const task = location.state.editTask;
            setEditingTask(task);
            setFormData({
                name: task.name,
                category: task.category || "",
                specialties: task.specialties || [],
                description: task.description || "",
                periodicity: task.periodicity,
                start_date: task.start_date
                    ? task.start_date.split("T")[0]
                    : "",
                end_date: task.end_date ? task.end_date.split("T")[0] : "",
                assigned_to: task.assigned_to || "",
                sector: task.sector || "",
                qb: task.qb || false,
                prazo_final: task.prazo_final
                    ? task.prazo_final.split("T")[0]
                    : "",
            });
            setView("form");
            setError(null);

            // Clear the location state to prevent repeating on refresh
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, location.pathname, navigate]);

    // Data
    const [tasks, setTasks] = useState<Task[]>([]);
    const [activeAssignedTasks, setActiveAssignedTasks] = useState<Task[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [meetingAvailableMembers, setMeetingAvailableMembers] = useState<
        Member[]
    >([]);
    const [missions, setMissions] = useState<any[]>([]);
    const [unavailabilities, setUnavailabilities] = useState<any[]>([]);
    const [annotations, setAnnotations] = useState<any[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
    const [filterSpecialties, setFilterSpecialties] = useState<string[]>([]);
    const [filterPeriodicities, setFilterPeriodicities] = useState<string[]>(
        [],
    );
    const [sortField, setSortField] = useState<string>("created_at");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
    const [selectedYear, setSelectedYear] = useState<number>(
        new Date().getFullYear(),
    );
    const [currentPage, setCurrentPage] = useState<number>(1);
    const [totalTasks, setTotalTasks] = useState<number>(0);
    const itemsPerPage = 100;
    const hasActiveFilters = searchTerm !== "" || filterStatuses.length > 0 ||
        filterSpecialties.length > 0 || filterPeriodicities.length > 0;

    // Category State
    const [categories, setCategories] = useState<Category[]>([]);
    const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");

    // Meeting Modal State
    const [showMeetingModal, setShowMeetingModal] = useState(false);
    const [meetingData, setMeetingData] = useState({
        assunto: "",
        inicio: "",
        fim: "",
        link: "",
    });
    const [meetingMembers, setMeetingMembers] = useState<string[]>([]);

    // Meeting List State
    const [meetings, setMeetings] = useState<any[]>([]);
    const [upcomingMeetings, setUpcomingMeetings] = useState<any[]>([]);
    const [isMeetingsExpanded, setIsMeetingsExpanded] = useState(false);
    const [editingMeetingId, setEditingMeetingId] = useState<string | null>(
        null,
    );
    const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
    const [meetingToDelete, setMeetingToDelete] = useState<any>(null);

    // Form State

    // Collapsible Sections State
    const [isEfetivoOpen, setIsEfetivoOpen] = useState(true);
    const [isTarefasOpen, setIsTarefasOpen] = useState(true);
    const [isReunioesOpen, setIsReunioesOpen] = useState(true);

    // Strategic Summary state
    const [isStrategicSummaryOpen, setIsStrategicSummaryOpen] = useState(false);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isSlidePaused, setIsSlidePaused] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [sdiaEvents, setSdiaEvents] = useState<any[]>([]);
    const [popupPendingTasks, setPopupPendingTasks] = useState<Task[]>([]);
    const [popupMeetings, setPopupMeetings] = useState<any[]>([]);

    useEffect(() => {
        if (isStrategicSummaryOpen) {
            const loadPopupData = async () => {
                try {
                    const today = new Date().toLocaleDateString("en-CA");
                    const tenDaysLater = new Date();
                    tenDaysLater.setDate(tenDaysLater.getDate() + 10);
                    const tenDaysLaterStr = tenDaysLater.toLocaleDateString(
                        "en-CA",
                    );

                    const userJson = localStorage.getItem("currentUser");
                    const userObj = userJson ? JSON.parse(userJson) : null;
                    const userSector = userObj?.sector;

                    // 1. Fetch SDIA events for the next 10 days (filtered by sector, unless CH)
                    let sdiaQuery = supabase
                        .from("sdia")
                        .select("*")
                        .gte("data_inicio", today)
                        .lte("data_inicio", tenDaysLaterStr)
                        .order("data_inicio", { ascending: true });

                    if (userSector && userSector !== "CH") {
                        sdiaQuery = sdiaQuery.eq("sector", userSector);
                    }
                    const { data: sdiaData } = await sdiaQuery;
                    if (sdiaData) setSdiaEvents(sdiaData);

                    // 2. Fetch Pending Tasks of current month with qb === true (filtered by sector, unless CH)
                    const now = new Date();
                    const startOfMonth = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        1,
                    ).toLocaleDateString("en-CA");
                    const endOfMonth = new Date(
                        now.getFullYear(),
                        now.getMonth() + 1,
                        0,
                    ).toLocaleDateString("en-CA");

                    let tasksQuery = supabase
                        .from("tasks")
                        .select("*")
                        .eq("qb", true)
                        .neq("status", "concluida")
                        .gte("start_date", startOfMonth)
                        .lte("start_date", endOfMonth)
                        .order("start_date", { ascending: true });

                    if (userSector && userSector !== "CH") {
                        tasksQuery = tasksQuery.eq("sector", userSector);
                    }
                    const { data: tasksData } = await tasksQuery;
                    if (tasksData) setPopupPendingTasks(tasksData);

                    // 3. Fetch Meetings and filter by sector involvement (unless CH)
                    const { data: meetingsData } = await supabase
                        .from("meeting")
                        .select("*")
                        .order("inicio", { ascending: true });

                    const { data: allMembersData } = await supabase
                        .from("members")
                        .select("id, sector");

                    if (meetingsData && allMembersData && userSector) {
                        const memberSectorMap = new Map<string, string>();
                        allMembersData.forEach((m: any) => {
                            if (m.sector) memberSectorMap.set(m.id, m.sector);
                        });

                        const filteredMeetings = meetingsData.filter(
                            (m: any) => {
                                const isUpcoming = m.inicio >= today;
                                if (!isUpcoming) return false;
                                if (userSector === "CH") return true; // CH sees all meetings
                                return m.membros?.some((memberId: string) => {
                                    return memberSectorMap.get(memberId) ===
                                        userSector;
                                });
                            },
                        );
                        setPopupMeetings(filteredMeetings);
                    } else if (meetingsData) {
                        const filteredMeetings = meetingsData.filter((m: any) =>
                            m.inicio >= today
                        );
                        setPopupMeetings(filteredMeetings);
                    }
                } catch (err) {
                    console.error("Error loading strategic popup data:", err);
                }
            };
            loadPopupData();
        }
    }, [isStrategicSummaryOpen]);

    useEffect(() => {
        let clockInterval: any;
        let slideInterval: any;

        if (isStrategicSummaryOpen) {
            // Clock interval (UTC-3 formatted via client America/Sao_Paulo timezone)
            clockInterval = setInterval(() => {
                setCurrentTime(new Date());
            }, 1000);

            // Slideshow rotation (10s interval, looping infinitely)
            if (!isSlidePaused) {
                slideInterval = setInterval(() => {
                    setCurrentSlide((prev) => (prev + 1) % 4);
                }, 10000);
            }
        } else {
            setCurrentSlide(0);
        }

        return () => {
            clearInterval(clockInterval);
            clearInterval(slideInterval);
        };
    }, [isStrategicSummaryOpen, isSlidePaused]);

    // Format UTC-3 timezone date/time details
    const getUTC3DateTime = (date: Date) => {
        const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Sao_Paulo",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });
        const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
            timeZone: "America/Sao_Paulo",
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
        });

        const timeStr = timeFormatter.format(date);
        const dateStr = dateFormatter.format(date);
        const capitalizedDateStr = dateStr.charAt(0).toUpperCase() +
            dateStr.slice(1);

        return { timeStr, dateStr: capitalizedDateStr };
    };

    const slideTitles = [
        "Controle do Efetivo",
        "Projetos em Andamento",
        "D-10 - Próximos Eventos",
        "Reuniões Agendadas",
    ];

    useEffect(() => {
        const userJson = localStorage.getItem("currentUser");
        if (userJson) {
            setCurrentUser(JSON.parse(userJson));
        }
        fetchMembers();
        fetchMissions();
        fetchUnavailabilities();
        fetchAnnotations();
        fetchCategories();
        fetchMeetings();
    }, []);

    const fetchMeetings = async () => {
        try {
            const userJson = localStorage.getItem("currentUser");
            const userObj = userJson ? JSON.parse(userJson) : null;
            if (!userObj) return;

            // 1. Fetch all meetings for admin list
            const { data, error } = await supabase
                .from("meeting")
                .select("*")
                .contains("membros", [userObj.id])
                .order("inicio", { ascending: false });
            if (error) throw error;
            setMeetings(data || []);

            // 2. Fetch upcoming meetings for floating widget
            const now = new Date().toISOString();
            const { data: upcomingData, error: upcomingError } = await supabase
                .from("meeting")
                .select("*")
                .contains("membros", [userObj.id])
                .gte("fim", now)
                .order("inicio", { ascending: true });
            if (upcomingError) throw upcomingError;
            setUpcomingMeetings(upcomingData || []);

            const todayString = new Date().toLocaleDateString("en-CA");
            const hasMeetingToday = upcomingData?.some((m: any) =>
                m.inicio.startsWith(todayString)
            );
            if (hasMeetingToday) {
                setIsMeetingsExpanded(true);
            }
        } catch (err: any) {
            console.error("Error fetching meetings:", err.message);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, [selectedYear, currentPage]);

    // When filters change, reset to page 1 and re-fetch all tasks
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterStatuses, filterSpecialties, filterPeriodicities]);

    useEffect(() => {
        fetchTasks();
    }, [hasActiveFilters]);

    const fetchMembers = async () => {
        try {
            const { data, error } = await supabase
                .from("members")
                .select(
                    "id, name, avatar, abrev, war_name, status, rank, sector, last_promotion_date, guia_antiguidade",
                );
            if (error) throw error;

            const userJson = localStorage.getItem("currentUser");
            let userSector = null;
            if (userJson) {
                userSector = JSON.parse(userJson).sector;
            }

            let filtered = data || [];
            if (userSector === "CP" || userSector === "EA") {
                filtered = filtered.filter((m) => m.sector === userSector);
            } else if (userSector === "CH") {
                filtered = filtered.filter((m) =>
                    m.sector === "CP" || m.sector === "EA" || m.sector === "CH"
                );
            }

            const sorted = filtered.sort((a, b) => {
                // 1ª Camada: Posto/Graduação (Rank)
                const pA = getRankPriority(a.rank, a.abrev);
                const pB = getRankPriority(b.rank, b.abrev);
                if (pA !== pB) return pA - pB;

                // 2ª Camada: Data da última promoção (Mais antiga primeiro)
                // Usamos um fallback para uma data muito futura caso esteja nulo
                const dateA = new Date(a.last_promotion_date || "9999-12-31")
                    .getTime();
                const dateB = new Date(b.last_promotion_date || "9999-12-31")
                    .getTime();
                if (dateA !== dateB) return dateA - dateB;

                // 3ª Camada: Guia de Antiguidade (Menor número = mais antigo)
                const guiaA = a.guia_antiguidade || 999999;
                const guiaB = b.guia_antiguidade || 999999;
                if (guiaA !== guiaB) return guiaA - guiaB;

                // Desempate final: Nome de Guerra
                const nameA = a.war_name || a.name || "";
                const nameB = b.war_name || b.name || "";
                return nameA.localeCompare(nameB);
            });

            setMembers(sorted);

            // Filter all members from CP, EA, and CH for meetings
            let meetingFiltered = (data || []).filter((m) =>
                m.sector === "CP" || m.sector === "EA" || m.sector === "CH"
            );
            const sortedMeeting = [...meetingFiltered].sort((a, b) => {
                const pA = getRankPriority(a.rank, a.abrev);
                const pB = getRankPriority(b.rank, b.abrev);
                if (pA !== pB) return pA - pB;

                const dateA = new Date(a.last_promotion_date || "9999-12-31")
                    .getTime();
                const dateB = new Date(b.last_promotion_date || "9999-12-31")
                    .getTime();
                if (dateA !== dateB) return dateA - dateB;

                const guiaA = a.guia_antiguidade || 999999;
                const guiaB = b.guia_antiguidade || 999999;
                if (guiaA !== guiaB) return guiaA - guiaB;

                const nameA = a.war_name || a.name || "";
                const nameB = b.war_name || b.name || "";
                return nameA.localeCompare(nameB);
            });
            setMeetingAvailableMembers(sortedMeeting);
        } catch (err) {
            console.error("Error fetching members:", err);
        }
    };

    const fetchCategories = async () => {
        try {
            const { data, error } = await supabase
                .from("task_cat")
                .select("*")
                .order("nome_cat");
            if (error) throw error;
            setCategories(data || []);
        } catch (err) {
            console.error("Error fetching categories:", err);
        }
    };

    const fetchTasks = async () => {
        try {
            setLoading(true);
            const userJson = localStorage.getItem("currentUser");
            const sector = userJson ? JSON.parse(userJson).sector : null;

            let query = supabase
                .from("tasks")
                .select("*", { count: "exact" })
                .gte("start_date", `${selectedYear}-01-01`)
                .lte("start_date", `${selectedYear}-12-31`)
                .order("created_at", { ascending: sortDirection === "asc" });

            if (sector && (sector === "CP" || sector === "EA")) {
                query = query.eq("sector", sector);
            }

            // If filters are active, fetch ALL tasks so client-side filtering + pagination works correctly
            if (hasActiveFilters) {
                const { data, error, count } = await query;
                if (error) throw error;
                setTasks(data || []);
                setTotalTasks(count || 0);
            } else {
                // No filters: use server-side pagination
                const startRange = (currentPage - 1) * itemsPerPage;
                const endRange = currentPage * itemsPerPage - 1;
                const { data, error, count } = await query.range(
                    startRange,
                    endRange,
                );
                if (error) throw error;
                setTasks(data || []);
                setTotalTasks(count || 0);
            }

            // --- FETCH ALL ACTIVE ASSIGNED TASKS FOR "CONTROLE DO EFETIVO" ---
            let activeQuery = supabase
                .from("tasks")
                .select("*")
                .not("assigned_to", "is", null)
                .neq("status", "concluida");

            if (sector && (sector === "CP" || sector === "EA")) {
                activeQuery = activeQuery.eq("sector", sector);
            }

            const { data: activeData, error: activeError } = await activeQuery;
            if (activeError) throw activeError;

            // Apply Dashboard's "start_date" logic to accurately reflect active assignments
            const validActiveTasks = (activeData || []).filter((task: any) => {
                if (!task.start_date) return true;
                const startDate = parseLocalDate(task.start_date);
                if (!startDate) return true;
                startDate.setHours(0, 0, 0, 0);
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                return startDate <= now;
            });

            setActiveAssignedTasks(validActiveTasks);
            // -----------------------------------------------------------------
        } catch (err: any) {
            console.error("Error fetching tasks:", err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchMissions = async () => {
        try {
            const userJson = localStorage.getItem("currentUser");
            const sector = userJson ? JSON.parse(userJson).sector : null;
            let query = supabase.from("missions").select("*");
            if (sector && (sector === "CP" || sector === "EA")) {
                query = query.eq("sector", sector);
            }
            const { data, error } = await query;
            if (error) throw error;
            setMissions(data || []);
        } catch (err: any) {
            console.error("Error fetching missions:", err.message);
        }
    };

    const fetchUnavailabilities = async () => {
        try {
            const today = new Date().toLocaleDateString("en-CA");
            const { data, error } = await supabase
                .from("unavailability")
                .select("*")
                .lte("start_date", today)
                .gte("end_date", today);
            if (error) throw error;
            setUnavailabilities(data || []);
        } catch (err: any) {
            console.error("Error fetching unavailabilities:", err.message);
        }
    };

    const fetchAnnotations = async () => {
        try {
            const today = new Date().toLocaleDateString("en-CA");
            const { data, error } = await supabase
                .from("annotations")
                .select("*")
                .eq("date", today);
            if (error) throw error;
            setAnnotations(data || []);
        } catch (err: any) {
            console.error("Error fetching annotations:", err.message);
        }
    };

    const getMemberMission = (memberId: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const activeMission = missions.find((miss) => {
            if (!miss.equipe || !miss.equipe.includes(memberId)) return false;
            const start = parseLocalDate(miss.data_inicio);
            const endD = parseLocalDate(miss.data_fim);
            const end = endD
                ? new Date(
                    endD.getFullYear(),
                    endD.getMonth(),
                    endD.getDate(),
                    23,
                    59,
                    59,
                )
                : null;
            if (!start || !end) return false;
            return today >= start && today <= end;
        });
        return activeMission;
    };

    const getMemberUnavailToday = (memberId: string) => {
        return unavailabilities.find((u) => u.member === memberId);
    };

    // FORM HANDLERS
    const handleInputChange = (
        e: React.ChangeEvent<
            HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >,
    ) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSpecialtyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = e.target;
        setFormData((prev) => {
            const newSpecialties = checked
                ? [...prev.specialties, value]
                : prev.specialties.filter((s) => s !== value);
            return { ...prev, specialties: newSpecialties };
        });
    };

    const handleCreateNew = () => {
        setEditingTask(null);
        setFormData({
            name: "",
            category: "",
            specialties: ["BCT", "AIS"],
            description: "",
            periodicity: "",
            start_date: new Date().toLocaleDateString("en-CA"),
            end_date: "",
            assigned_to: "",
            sector: "",
            qb: false,
            prazo_final: "",
        });
        setView("form");
        setError(null);
    };

    const handleEdit = (task: Task) => {
        setEditingTask(task);
        setFormData({
            name: task.name,
            category: task.category || "",
            specialties: task.specialties || [],
            description: task.description || "",
            periodicity: task.periodicity,
            start_date: task.start_date ? task.start_date.split("T")[0] : "",
            end_date: task.end_date ? task.end_date.split("T")[0] : "",
            assigned_to: task.assigned_to || "",
            sector: task.sector || "",
            qb: task.qb || false,
            prazo_final: task.prazo_final ? task.prazo_final.split("T")[0] : "",
        });
        setView("form");
        setError(null);
    };

    const handleClone = (task: Task) => {
        setEditingTask(null);
        setFormData({
            name: `${task.name}`,
            category: task.category || "",
            specialties: task.specialties || [],
            description: task.description || "",
            periodicity: task.periodicity,
            start_date: new Date().toLocaleDateString("en-CA"),
            end_date: "",
            assigned_to: "",
            sector: task.sector || "",
            qb: task.qb || false,
            prazo_final: task.prazo_final ? task.prazo_final.split("T")[0] : "",
        });
        setView("form");
        setError(null);
    };

    const handleRevertStatus = async () => {
        if (!editingTask || !editingTask.id) return;
        setLoading(true);
        try {
            const { error: updateError, data: revertedTask } = await supabase
                .from("tasks")
                .update({ status: "pendente" })
                .eq("id", editingTask.id)
                .select("mission_id")
                .single();
            if (updateError) throw updateError;

            if (revertedTask && revertedTask.mission_id) {
                await supabase.from("missions").update({ fav: false }).eq(
                    "id",
                    revertedTask.mission_id,
                );
            }

            await fetchTasks();
            setView("list");
            setEditingTask(null);
        } catch (err: any) {
            console.error("Error reverting status:", err.message);
            setError("Erro ao reverter status: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFormData((prev) => ({ ...prev, category: e.target.value }));
    };

    const handleSaveNewCategory = async () => {
        if (!newCategoryName.trim()) return;

        try {
            const { data, error } = await supabase
                .from("task_cat")
                .insert([{ nome_cat: newCategoryName }])
                .select()
                .single();

            if (error) throw error;

            // Add to list and select it
            setCategories((prev) =>
                [...prev, data].sort((a, b) =>
                    a.nome_cat.localeCompare(b.nome_cat)
                )
            );
            setFormData((prev) => ({ ...prev, category: newCategoryName })); // Or data.nome_cat
            setShowNewCategoryModal(false);
            setNewCategoryName("");
        } catch (err: any) {
            alert("Erro ao criar categoria: " + err.message);
        }
    };

    const handleScheduleMeeting = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const payload = {
                assunto: meetingData.assunto,
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
            setMeetingData({ assunto: "", inicio: "", fim: "", link: "" });
            setMeetingMembers([]);
            setEditingMeetingId(null);
            fetchMeetings();
        } catch (err: any) {
            console.error("Error scheduling meeting:", err.message);
            alert("Erro ao agendar reunião: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleEditMeeting = (meeting: any) => {
        setEditingMeetingId(meeting.id);
        setMeetingData({
            assunto: meeting.assunto,
            inicio: meeting.inicio.slice(0, 16),
            fim: meeting.fim.slice(0, 16),
            link: meeting.link || "",
        });
        setMeetingMembers(meeting.membros || []);
        setShowMeetingModal(true);
    };

    const handleCloneMeeting = (meeting: any) => {
        setEditingMeetingId(null);
        setMeetingData({
            assunto: `Cópia: ${meeting.assunto}`,
            inicio: meeting.inicio.slice(0, 16),
            fim: meeting.fim.slice(0, 16),
            link: meeting.link || "",
        });
        setMeetingMembers(meeting.membros || []);
        setShowMeetingModal(true);
    };

    const handleDeleteMeeting = (meeting: any) => {
        setMeetingToDelete(meeting);
    };

    const confirmDeleteMeeting = React.useCallback(async () => {
        if (!meetingToDelete) return;
        setLoading(true);
        try {
            const { error } = await supabase.from("meeting").delete().eq(
                "id",
                meetingToDelete.id,
            );
            if (error) throw error;
            fetchMeetings();
            setMeetingToDelete(null);
        } catch (err: any) {
            console.error("Error deleting meeting:", err.message);
            alert("Erro ao excluir reunião: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [meetingToDelete]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Validation for Periodicity
        if (!formData.periodicity || formData.periodicity === "") {
            setError("Por favor, selecione a periodicidade da tarefa.");
            setLoading(false);
            return;
        }

        // Validation for Pontual
        if (formData.periodicity === "pontual" && !formData.end_date) {
            setError(
                "A data de conclusão é obrigatória para tarefas pontuais.",
            );
            setLoading(false);
            return;
        }

        // Validation for Specialties
        if (formData.specialties.length === 0) {
            setError(
                "Você deve selecionar pelo menos uma especialidade.",
            );
            setLoading(false);
            return;
        }

        const recurrenceActive = editingTask
            ? (editingTask.recurrence_active ?? false)
            : ["diaria", "semanal", "quinzenal", "mensal"]
                .includes(formData.periodicity);

        try {
            const payload = {
                name: formData.name,
                category: formData.category,
                description: formData.description,
                specialties: formData.specialties,
                periodicity: formData.periodicity,
                start_date: formData.start_date,
                end_date: formData.periodicity === "pontual"
                    ? formData.end_date
                    : null,
                assigned_to: formData.assigned_to || null,
                recurrence_active: recurrenceActive,
                status: editingTask ? undefined : "pendente",
                sector: editingTask
                    ? undefined
                    : (currentUser?.sector === "CH"
                        ? formData.sector
                        : currentUser?.sector),
                qb: formData.periodicity === "pontual" ? formData.qb : false,
                prazo_final:
                    formData.periodicity === "pontual" && formData.qb &&
                        formData.prazo_final
                        ? formData.prazo_final
                        : null,
            };

            if (
                currentUser?.sector === "CH" && !editingTask && !formData.sector
            ) {
                setError(
                    "Por favor, selecione para qual seção (Capacidade ATC ou Espaço Aéreo) esta tarefa será criada.",
                );
                setLoading(false);
                return;
            }

            if (editingTask && editingTask.id) {
                // Update
                const { error: updateError } = await supabase
                    .from("tasks")
                    .update(payload)
                    .eq("id", editingTask.id);
                if (updateError) throw updateError;
            } else {
                // Insert
                const { error: insertError } = await supabase
                    .from("tasks")
                    .insert([payload]);
                if (insertError) throw insertError;
            }

            await fetchTasks();
            setView("list");
        } catch (err: any) {
            console.error("Error saving task:", err.message);
            setError("Erro ao salvar tarefa: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Modal States

    // LIST ACTIONS
    const handleDelete = (task: Task) => {
        setTaskToDelete(task);
    };

    const confirmDelete = React.useCallback(async () => {
        if (!taskToDelete) return;

        try {
            const { error } = await supabase.from("tasks").delete().eq(
                "id",
                taskToDelete.id,
            );
            if (error) throw error;
            setTasks((prev) => prev.filter((t) => t.id !== taskToDelete.id));
            setTaskToDelete(null);
        } catch (err: any) {
            alert("Erro ao apagar: " + err.message);
        }
    }, [taskToDelete]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (taskToDelete) {
                if (e.key === "Enter") {
                    confirmDelete();
                } else if (e.key === "Escape") {
                    setTaskToDelete(null);
                }
            }
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
    }, [taskToDelete, confirmDelete, meetingToDelete, confirmDeleteMeeting]);

    const handleToggleRecurrence = async (task: Task) => {
        try {
            const { error } = await supabase
                .from("tasks")
                .update({ recurrence_active: !task.recurrence_active })
                .eq("id", task.id);
            if (error) throw error;

            setTasks((prev) =>
                prev.map((t) =>
                    t.id === task.id
                        ? { ...t, recurrence_active: !task.recurrence_active }
                        : t
                )
            );
        } catch (err: any) {
            alert("Erro ao alterar recorrência: " + err.message);
        }
    };

    // HELPERS
    const canDelete = () => {
        if (!currentUser) return false;
        const rankValue = getRankPriority(currentUser.rank, currentUser.abrev);
        return rankValue <= 8; // Major(1) to SGT(5) AQUI É O FILTRO DE QUEM PODE DELETAR
    };

    const getMemberName = (id: string | null) => {
        if (!id) return "Banco de Tarefas";
        const member = members.find((m) => m.id === id);
        return member ? member.name : "Desconhecido";
    };

    const formatPeriodicity = (p: string) => {
        const map: any = {
            "diaria": "Diária",
            "semanal": "Semanal",
            "quinzenal": "Quinzenal",
            "mensal": "Mensal",
            "temporada": "Temporada",
            "pontual": "Pontual",
        };
        return map[p] || p;
    };

    const getStatusLabel = (s: string) => {
        const map: any = {
            "pendente": "Pendente",
            "iniciada": "Andamento",
            //'pausada': 'Pausada',
            "concluida": "Concluída",
        };
        return map[s] || s;
    };

    const getStatusStyle = (s: string) => {
        switch (s) {
            case "concluida":
                return "bg-green-100 text-green-700";
            case "iniciada":
                return "bg-blue-100 text-blue-700";
            //case 'pausada': return 'bg-amber-100 text-amber-700';
            default:
                return "bg-slate-100 text-slate-600";
        }
    };

    const getTaskHighlight = (task: Task) => {
        if (task.status === "concluida" || !task.end_date) return "";

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Parse YYYY-MM-DD strictly to local midnight
        const endDate = parseLocalDate(task.end_date);

        if (!endDate) return "";

        // Difference in days
        const diffTime = endDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // Use ceil to be safe, though setHours makes it exact usually

        if (diffDays < 0) {
            // Overdue (< 0)
            return "bg-red-50 text-red-600 px-2 py-0.5 rounded";
        } else if (diffDays <= 1) {
            // Due Today (0) or Tomorrow (1) - "Intersection 0-1"
            return "bg-amber-300 text-amber-800 px-2 py-0.5 rounded";
        } else if (diffDays <= 3) {
            // Upcoming (2, 3) - "Yellow 1-3" (excluding 1 as it falls in bucket above)
            return "bg-amber-100 text-amber-600 px-2 py-0.5 rounded";
        }

        return "";
    };

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortDirection((prev) => prev === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDirection("asc");
        }
    };

    // FILTERING
    const filteredTasks = tasks.filter((task) => {
        const matchesSearch =
            task.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (task.description || "").toLowerCase().includes(
                searchTerm.toLowerCase(),
            );

        const matchesStatus = filterStatuses.length === 0 ||
            filterStatuses.includes(task.status);
        const matchesSpecialty = filterSpecialties.length === 0 ||
            task.specialties?.some((s) => filterSpecialties.includes(s));
        const matchesPeriodicity = filterPeriodicities.length === 0 ||
            filterPeriodicities.includes(task.periodicity);

        return matchesSearch && matchesStatus && matchesSpecialty &&
            matchesPeriodicity;
    }).sort((a, b) => {
        let valA: any = "";
        let valB: any = "";

        switch (sortField) {
            case "name":
                valA = (a.name || "").toLowerCase();
                valB = (b.name || "").toLowerCase();
                break;
            case "periodicity":
                valA = formatPeriodicity(a.periodicity).toLowerCase();
                valB = formatPeriodicity(b.periodicity).toLowerCase();
                break;
            case "start_date":
                valA = a.start_date || "";
                valB = b.start_date || "";
                break;
            case "assigned_to":
                valA = getMemberName(a.assigned_to).toLowerCase();
                valB = getMemberName(b.assigned_to).toLowerCase();
                break;
            case "status":
                valA = getStatusLabel(a.status).toLowerCase();
                valB = getStatusLabel(b.status).toLowerCase();
                break;
            default:
                valA = a.created_at || "";
                valB = b.created_at || "";
        }

        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
    });

    // When filters are active, paginate client-side over the full filtered set.
    // When no filters, server already returned the right page.
    const displayedTasks = hasActiveFilters
        ? filteredTasks.slice(
            (currentPage - 1) * itemsPerPage,
            currentPage * itemsPerPage,
        )
        : filteredTasks;

    const totalCount = hasActiveFilters ? filteredTasks.length : totalTasks;
    const totalPages = Math.ceil(totalCount / itemsPerPage);

    if (view === "form") {
        // FORM VIEW
        return (
            <div className="max-w-4xl mx-auto flex flex-col gap-8 animate-in fade-in duration-500">
                <div className="flex flex-col gap-2">
                    <h1 className="text-[#0d141b] dark:text-white text-3xl font-extrabold leading-tight tracking-tight">
                        {editingTask
                            ? "Editar Tarefa"
                            : "Cadastrar Nova Tarefa"}
                    </h1>
                    <p className="text-[#4c739a] dark:text-slate-400 text-base font-normal">
                        Preencha os dados abaixo para{" "}
                        {editingTask ? "atualizar a" : "criar uma nova"}{" "}
                        atividade técnica.
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
                                    <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                        Nome da Tarefa
                                    </label>
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
                                    <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                        Categoria
                                    </label>
                                    <div className="flex gap-2">
                                        <select
                                            name="category"
                                            value={formData.category}
                                            onChange={handleCategoryChange}
                                            className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3"
                                        >
                                            <option value="">
                                                Selecione uma categoria...
                                            </option>
                                            {categories.map((cat) => (
                                                <option
                                                    key={cat.id}
                                                    value={cat.nome_cat}
                                                >
                                                    {cat.nome_cat}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowNewCategoryModal(true)}
                                            className="h-[46px] w-[50px] flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#4c739a] border border-[#cfdbe7] dark:border-slate-700 transition-colors"
                                            title="Nova Categoria"
                                        >
                                            <span className="material-symbols-outlined text-[24px]">
                                                add
                                            </span>
                                        </button>
                                    </div>
                                </div>
                                {currentUser?.sector === "CH" && !editingTask &&
                                    (
                                        <div className="flex flex-col gap-2 col-span-2">
                                            <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                                Seção de Destino
                                            </label>
                                            <select
                                                name="sector"
                                                value={formData.sector}
                                                onChange={handleInputChange}
                                                className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3"
                                                required
                                            >
                                                <option value="">
                                                    Selecione o Setor...
                                                </option>
                                                <option value="CP">
                                                    Capacidade ATC (CP)
                                                </option>
                                                <option value="EA">
                                                    Espaço Aéreo (EA)
                                                </option>
                                            </select>
                                        </div>
                                    )}
                                <div className="flex flex-col gap-2 col-span-2 md:col-span-1">
                                    <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                        Especialidade Requerida
                                    </label>
                                    <div className="flex gap-2">
                                        <label className="flex-1 cursor-pointer">
                                            <input
                                                className="hidden peer"
                                                type="checkbox"
                                                value="BCT"
                                                checked={formData.specialties
                                                    .includes("BCT")}
                                                onChange={handleSpecialtyChange}
                                            />
                                            <div className="text-center p-3 rounded-lg border border-[#cfdbe7] dark:border-slate-700 peer-checked:bg-primary/10 peer-checked:border-primary peer-checked:text-primary transition-all text-sm font-medium active:scale-95">
                                                BCT
                                            </div>
                                        </label>
                                        <label className="flex-1 cursor-pointer">
                                            <input
                                                className="hidden peer"
                                                type="checkbox"
                                                value="AIS"
                                                checked={formData.specialties
                                                    .includes("AIS")}
                                                onChange={handleSpecialtyChange}
                                            />
                                            <div className="text-center p-3 rounded-lg border border-[#cfdbe7] dark:border-slate-700 peer-checked:bg-primary/10 peer-checked:border-primary peer-checked:text-primary transition-all text-sm font-medium active:scale-95">
                                                AIS
                                            </div>
                                        </label>
                                        <label className="flex-1 cursor-pointer">
                                            <input
                                                className="hidden peer"
                                                type="checkbox"
                                                value="CTA"
                                                checked={formData.specialties
                                                    .includes("CTA")}
                                                onChange={handleSpecialtyChange}
                                            />
                                            <div className="text-center p-3 rounded-lg border border-[#cfdbe7] dark:border-slate-700 peer-checked:bg-primary/10 peer-checked:border-primary peer-checked:text-primary transition-all text-sm font-medium active:scale-95">
                                                CTA
                                            </div>
                                        </label>
                                        <label className="flex-1 cursor-pointer">
                                            <input
                                                className="hidden peer"
                                                type="checkbox"
                                                value="TAAM"
                                                checked={formData.specialties
                                                    .includes("TAAM")}
                                                onChange={handleSpecialtyChange}
                                            />
                                            <div className="text-center p-3 rounded-lg border border-[#cfdbe7] dark:border-slate-700 peer-checked:bg-primary/10 peer-checked:border-primary peer-checked:text-primary transition-all text-sm font-medium active:scale-95">
                                                TAAM
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-b border-[#e7edf3] dark:border-slate-800">
                            <div className="flex flex-col gap-2">
                                <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                    Descrição detalhada
                                </label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    className="w-full min-h-32 rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3 resize-none"
                                    placeholder="Descreva as etapas, objetivos e requisitos técnicos da tarefa..."
                                >
                                </textarea>
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50/50 dark:bg-slate-800/20">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="flex flex-col gap-2">
                                    <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                        Periodicidade
                                    </label>
                                    <select
                                        name="periodicity"
                                        value={formData.periodicity}
                                        onChange={handleInputChange}
                                        className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3"
                                    >
                                        <option value="" disabled hidden>
                                            Selecione a Periodicidade...
                                        </option>
                                        <option value="diaria">Diária</option>
                                        <option value="semanal">Semanal</option>
                                        <option value="quinzenal">
                                            Quinzenal
                                        </option>
                                        <option value="mensal">Mensal</option>
                                        <option value="temporada">
                                            Temporada
                                        </option>
                                        <option value="pontual">Pontual</option>
                                    </select>
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                        Data de Início
                                    </label>
                                    <div className="relative">
                                        <input
                                            name="start_date"
                                            value={formData.start_date}
                                            onChange={handleInputChange}
                                            className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3 pl-10"
                                            type="date"
                                            required
                                        />
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#4c739a] pointer-events-none text-xl">
                                            calendar_today
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                        Membro Designado (Opcional)
                                    </label>
                                    <select
                                        name="assigned_to"
                                        value={formData.assigned_to}
                                        onChange={handleInputChange}
                                        className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3"
                                    >
                                        <option value="">
                                            Em branco (Banco de Tarefas)
                                        </option>
                                        {members.map((member) => (
                                            <option
                                                key={member.id}
                                                value={member.id}
                                            >
                                                {member.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {formData.periodicity === "pontual" && (
                                    <>
                                        <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                                Prazo de Conclusão
                                            </label>
                                            <div className="relative">
                                                <input
                                                    name="end_date"
                                                    value={formData.end_date}
                                                    onChange={handleInputChange}
                                                    className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3 pl-10"
                                                    type="date"
                                                />
                                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#4c739a] pointer-events-none text-xl">
                                                    event_available
                                                </span>
                                            </div>
                                        </div>

                                        {formData.qb && (
                                            <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                                <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                                    Prazo Final (Quadro Branco)
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        name="prazo_final"
                                                        value={formData
                                                            .prazo_final}
                                                        onChange={handleInputChange}
                                                        className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3 pl-10"
                                                        type="date"
                                                    />
                                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#4c739a] pointer-events-none text-xl">
                                                        event_available
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="p-6 border-t border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-4 mr-auto">
                                {editingTask &&
                                    editingTask.status === "concluida" && (
                                    <button
                                        className="px-6 py-2.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 text-sm font-bold hover:bg-amber-100 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400 transition-colors flex items-center gap-2"
                                        type="button"
                                        onClick={handleRevertStatus}
                                        disabled={loading}
                                    >
                                        <span className="material-symbols-outlined text-[20px]">
                                            history
                                        </span>
                                        Reverter Status
                                    </button>
                                )}
                                {formData.periodicity === "pontual" && (
                                    <label className="flex items-center gap-2 text-sm font-semibold text-[#0d141b] dark:text-white cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            name="qb"
                                            checked={formData.qb}
                                            onChange={(e) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    qb: e.target.checked,
                                                }))}
                                            className="rounded border-[#cfdbe7] dark:border-slate-700 text-primary focus:ring-primary h-4 w-4"
                                        />
                                        Inserir no Quadro Branco?
                                    </label>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    className="px-6 py-2.5 rounded-lg border border-[#cfdbe7] dark:border-slate-700 text-[#0d141b] dark:text-white text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                    type="button"
                                    onClick={() => setView("list")}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className="px-6 py-2.5 rounded-lg bg-primary text-white text-sm font-bold shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                                    type="submit"
                                    disabled={loading}
                                >
                                    {loading && (
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white">
                                        </div>
                                    )}
                                    {loading ? "Salvando..." : "Salvar Tarefa"}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
                {/* New Category Modal (Form View) */}
                {showNewCategoryModal && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-[#e7edf3] dark:border-slate-800 w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-4 flex flex-col gap-3">
                                <h3 className="text-sm font-bold text-[#0d141b] dark:text-white uppercase tracking-wider">
                                    Nova Categoria
                                </h3>
                                <div className="flex gap-2">
                                    <input
                                        autoFocus
                                        value={newCategoryName}
                                        onChange={(e) =>
                                            setNewCategoryName(e.target.value)}
                                        className="flex-1 rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-[#f8fafc] dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-2"
                                        placeholder="Nome da categoria..."
                                        type="text"
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                handleSaveNewCategory();
                                            }
                                            if (e.key === "Escape") {
                                                setShowNewCategoryModal(false);
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={handleSaveNewCategory}
                                        disabled={!newCategoryName.trim()}
                                        className="p-2 rounded-lg bg-green-500 hover:bg-green-600 text-white shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Confirmar"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">
                                            check
                                        </span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowNewCategoryModal(false);
                                            setNewCategoryName("");
                                        }}
                                        className="p-2 rounded-lg bg-red-500 hover:bg-red-600 text-white shadow-md transition-all active:scale-95"
                                        title="Cancelar"
                                    >
                                        <span className="material-symbols-outlined text-[20px]">
                                            close
                                        </span>
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
                <div className="flex flex-wrap items-center gap-3">
                    <button 
                        onClick={() => setIsEfetivoOpen(!isEfetivoOpen)}
                        className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left"
                    >
                        <span className="material-symbols-outlined text-[28px] text-primary">
                            {isEfetivoOpen ? "expand_less" : "expand_more"}
                        </span>
                        <h1 className="text-[#0d141b] dark:text-white text-3xl font-extrabold leading-tight tracking-tight">
                            Controle do Efetivo
                        </h1>
                    </button>
                    <button
                        onClick={() => navigate("/app/tasks/planner")}
                        className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-[#e7edf3] dark:border-slate-700 text-[#4c739a] hover:text-primary transition-all active:scale-95 shadow-sm"
                        title="Cronograma Mensal"
                    >
                        <span className="material-symbols-outlined text-[24px]">
                            calendar_month
                        </span>
                    </button>
                    <button
                        onClick={() => navigate("/app/tasks/unavailability")}
                        className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-[#e7edf3] dark:border-slate-700 text-[#4c739a] hover:text-primary transition-all active:scale-95 shadow-sm"
                        title="Gestão Anual"
                    >
                        <span className="material-symbols-outlined text-[24px]">
                            table
                        </span>
                    </button>
                    <button
                        onClick={() => setIsStrategicSummaryOpen(true)}
                        className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-[#e7edf3] dark:border-slate-700 text-[#4c739a] hover:text-primary transition-all active:scale-95 shadow-sm"
                        title="Resumo Estratégico"
                    >
                        <span className="material-symbols-outlined text-[24px]">
                            play_arrow
                        </span>
                    </button>
                </div>

                {isEfetivoOpen && (
                    <>
                        <p className="text-[#4c739a] dark:text-slate-400 text-base font-normal">
                            Tarefas atribuídas ao efetivo nesse momento.
                        </p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
                    {members
                        .filter((m) => {
                            // 1. CH vê todos os ranks
                            if (currentUser?.sector === "CH") return true;

                            const val = getRankPriority(m.rank, m.abrev);

                            // Busca a prioridade do usuário logado atualmente
                            const currentUserVal = getRankPriority(
                                currentUser?.rank,
                                currentUser?.abrev,
                            );

                            // 2. Se o usuário logado for nível <= 3, ele pode ver >= 3 - Tenente pra baixo
                            if (currentUserVal <= 3) return val >= 2;

                            // 3. Os outros (>= 4) veem apenas >= 4 - Suboficial pra baixo
                            return val >= 4;
                        })
                        .map((member) => {
                            const currentMission = getMemberMission(member.id);
                            const currentUnavail = getMemberUnavailToday(
                                member.id,
                            );
                            const isUnavailable =
                                member.status === "Indisponível" ||
                                !!currentUnavail;

                            // Get member tasks
                            const memberTasks = activeAssignedTasks.filter((
                                t,
                            ) => t.assigned_to === member.id);

                            // Get member annotations for today
                            const memberAnnotations = annotations.filter((a) =>
                                a.member_id === member.id
                            );

                            // Sort: In Progress first
                            memberTasks.sort((a, b) => {
                                if (
                                    a.status === "iniciada" &&
                                    b.status !== "iniciada"
                                ) return -1;
                                if (
                                    a.status !== "iniciada" &&
                                    b.status === "iniciada"
                                ) return 1;
                                return 0;
                            });

                            return (
                                <div
                                    key={member.id}
                                    className={`
                                        p-2 md:p-4 rounded-xl border shadow-sm flex flex-col gap-2 md:gap-3 transition-all duration-300
                                        ${
                                        currentMission
                                            ? "bg-amber-50/50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800"
                                            : isUnavailable &&
                                                    currentUnavail?.type ===
                                                        "Atividade"
                                            ? "bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-800"
                                            : isUnavailable
                                            ? "bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-800"
                                            : "bg-white border-[#e7edf3] dark:bg-slate-900 dark:border-slate-800"
                                    }
                                    `}
                                >
                                    <div className="flex flex-col items-center gap-2 mb-1">
                                        <div
                                            className={`
                                            w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center font-bold text-xs md:text-sm uppercase overflow-hidden shadow-sm border-2
                                            ${
                                                currentMission
                                                    ? "border-amber-400"
                                                    : isUnavailable &&
                                                            currentUnavail
                                                                    ?.type ===
                                                                "Atividade"
                                                    ? "border-green-400"
                                                    : isUnavailable
                                                    ? "border-red-400"
                                                    : "border-white dark:border-slate-800 bg-slate-200 dark:bg-slate-700 text-[#4c739a]"
                                            }
                                        `}
                                        >
                                            {/* Avatar or Initials */}
                                            {member.avatar
                                                ? (
                                                    <img
                                                        src={member.avatar}
                                                        alt={member.name}
                                                        className="w-full h-full object-cover"
                                                    />
                                                )
                                                : (
                                                    member.name.substring(0, 2)
                                                )}
                                        </div>
                                        <div className="flex flex-col items-center text-center">
                                            <span className="text-xs md:text-lg font-bold text-[#0d141b] dark:text-white leading-tight">
                                                {member.abrev} {member.war_name}
                                            </span>
                                            {currentMission
                                                ? (
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="material-symbols-outlined text-[14px] text-amber-600 dark:text-amber-500">
                                                            flight_takeoff
                                                        </span>
                                                        <span className="text-[10px] text-amber-600 dark:text-amber-500 font-bold uppercase tracking-wider">
                                                            Em Viagem
                                                        </span>
                                                    </div>
                                                )
                                                : isUnavailable &&
                                                        currentUnavail?.type ===
                                                            "Atividade"
                                                ? (
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="material-symbols-outlined text-[14px] text-green-600 dark:text-green-500">
                                                            event_note
                                                        </span>
                                                        <span className="text-[10px] text-green-600 dark:text-green-500 font-bold uppercase tracking-wider">
                                                            {currentUnavail
                                                                    ?.atividade ===
                                                                    "M"
                                                                ? "Indisponível pela Manhã"
                                                                : currentUnavail
                                                                        ?.atividade ===
                                                                        "T"
                                                                ? "Indisponível pela Tarde"
                                                                : "Indisponível Manhã e Tarde"}
                                                        </span>
                                                    </div>
                                                )
                                                : isUnavailable
                                                ? (
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="material-symbols-outlined text-[14px] text-red-600 dark:text-red-500">
                                                            block
                                                        </span>
                                                        <span className="text-[10px] text-red-600 dark:text-red-500 font-bold uppercase tracking-wider">
                                                            {currentUnavail
                                                                ? currentUnavail
                                                                    .type
                                                                : "Indisponível"}
                                                        </span>
                                                    </div>
                                                )
                                                : (
                                                    <span className="text-[10px] text-[#4c739a] font-medium uppercase mt-0.5">
                                                        {memberTasks.length}
                                                        {" "}
                                                        Atividades
                                                    </span>
                                                )}
                                        </div>
                                    </div>

                                    <div
                                        className={`h-px w-full ${
                                            currentMission
                                                ? "bg-amber-200 dark:bg-amber-800/50"
                                                : isUnavailable &&
                                                        currentUnavail?.type ===
                                                            "Atividade"
                                                ? "bg-green-200 dark:bg-green-800/50"
                                                : isUnavailable
                                                ? "bg-red-200 dark:bg-red-800/50"
                                                : "bg-[#e7edf3] dark:bg-slate-800"
                                        }`}
                                    >
                                    </div>

                                    <div className="flex flex-col gap-1.5 min-h-[60px]">
                                        {currentMission
                                            ? (
                                                <div className="flex items-start gap-2 py-1">
                                                    <div className="mt-0.5 p-1 bg-amber-100 dark:bg-amber-900/30 rounded">
                                                        <span className="material-symbols-outlined text-[14px] text-amber-600 dark:text-amber-500">
                                                            stars
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase leading-tight line-clamp-2">
                                                            {currentMission
                                                                .nome}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-amber-600/70 dark:text-amber-500/70 uppercase">
                                                            Missão Ativa
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                            : currentUnavail &&
                                                    [
                                                        "Atividade",
                                                        "Home Office",
                                                        "Dispensa",
                                                        "Outros",
                                                    ].includes(
                                                        currentUnavail.type,
                                                    )
                                            ? (
                                                <div className="flex items-start gap-2 py-1">
                                                    <div
                                                        className={`mt-0.5 p-1 rounded ${
                                                            currentUnavail
                                                                    .type ===
                                                                    "Atividade"
                                                                ? "bg-green-100 dark:bg-green-900/30"
                                                                : "bg-red-100 dark:bg-red-900/30"
                                                        }`}
                                                    >
                                                        <span
                                                            className={`material-symbols-outlined text-[14px] ${
                                                                currentUnavail
                                                                        .type ===
                                                                        "Atividade"
                                                                    ? "text-green-600 dark:text-green-500"
                                                                    : "text-red-600 dark:text-red-500"
                                                            }`}
                                                        >
                                                            {currentUnavail
                                                                    .type ===
                                                                    "Atividade"
                                                                ? "event_note"
                                                                : currentUnavail
                                                                        .type ===
                                                                        "Home Office"
                                                                ? "home"
                                                                : "info"}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span
                                                            className={`text-[11px] font-black uppercase leading-tight line-clamp-2 ${
                                                                currentUnavail
                                                                        .type ===
                                                                        "Atividade"
                                                                    ? "text-green-700 dark:text-green-400"
                                                                    : "text-red-700 dark:text-red-400"
                                                            }`}
                                                        >
                                                            {currentUnavail
                                                                .detalhes ||
                                                                "Sem detalhes informados"}
                                                        </span>
                                                        {
                                                            /* <span className={`text-[9px] font-bold uppercase ${  //Tipo de dispensa
                                                            currentUnavail.type === 'Atividade'
                                                                ? 'text-green-600/70 dark:text-green-500/70'
                                                                : 'text-red-600/70 dark:text-red-500/70'
                                                        }`}>
                                                            {currentUnavail.type}
                                                        </span> */
                                                        }
                                                    </div>
                                                </div>
                                            )
                                            : (
                                                <>
                                                    {memberTasks.length > 0
                                                        ? (
                                                            memberTasks.slice(
                                                                0,
                                                                3,
                                                            ).map((task) => (
                                                                <div
                                                                    key={task
                                                                        .id}
                                                                    className={`text-xs truncate py-0.5 cursor-help ${
                                                                        task.status ===
                                                                                "iniciada"
                                                                            ? "font-bold text-primary"
                                                                            : "text-[#4c739a]"
                                                                    }`}
                                                                    title={`${task.name}${
                                                                        task.description
                                                                            ? `\nDescrição: ${task.description}`
                                                                            : ""
                                                                    }${
                                                                        task.end_date
                                                                            ? `\nPrazo: ${
                                                                                new Date(
                                                                                    task.end_date +
                                                                                        "T12:00:00",
                                                                                ).toLocaleDateString(
                                                                                    "pt-BR",
                                                                                )
                                                                            }`
                                                                            : ""
                                                                    }`}
                                                                >
                                                                    {task
                                                                                .status ===
                                                                            "iniciada" &&
                                                                        "▶ "}
                                                                    {task.name}
                                                                </div>
                                                            ))
                                                        )
                                                        : (
                                                            <span className="text-[10px] text-slate-400 italic">
                                                                Sem tarefas
                                                                atribuídas
                                                            </span>
                                                        )}
                                                    {memberTasks.length > 3 && (
                                                        <span className="text-[10px] text-slate-400 font-medium">
                                                            + {memberTasks
                                                                .length - 3}
                                                            {" "}
                                                            outras...
                                                        </span>
                                                    )}
                                                </>
                                            )}

                                        {memberAnnotations &&
                                            memberAnnotations.length > 0 && (
                                            <div className="flex flex-col gap-1.5 mt-2 border-t border-slate-100 dark:border-slate-800/40 pt-2">
                                                {memberAnnotations.map((
                                                    anno,
                                                ) => (
                                                    <div
                                                        key={anno.id}
                                                        className="flex items-start gap-1.5 py-0.5"
                                                    >
                                                        <div className="mt-0.5 p-0.5 bg-amber-50 dark:bg-amber-950/20 rounded shrink-0">
                                                            <span className="material-symbols-outlined text-[12px] text-amber-600 dark:text-amber-500 leading-none">
                                                                sticky_note_2
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span
                                                                className="text-[10px] font-bold text-slate-700 dark:text-slate-300 leading-tight break-words"
                                                                title={anno
                                                                    .annotation}
                                                            >
                                                                {anno
                                                                    .annotation}
                                                            </span>
                                                            <span className="text-[8px] font-medium text-slate-400 dark:text-slate-500 uppercase">
                                                                Anotação: {anno
                                                                    .start_time}
                                                                {" "}
                                                                -{" "}
                                                                {anno.end_time}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                </div>
                </>
                )}
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <button 
                        onClick={() => setIsTarefasOpen(!isTarefasOpen)}
                        className="flex items-center gap-2 hover:opacity-80 transition-opacity text-left w-fit"
                    >
                        <span className="material-symbols-outlined text-[28px] text-primary">
                            {isTarefasOpen ? "expand_less" : "expand_more"}
                        </span>
                        <h1 className="text-[#0d141b] dark:text-white text-3xl font-extrabold leading-tight tracking-tight">
                            Gerenciamento de Tarefas
                        </h1>
                    </button>
                    {isTarefasOpen && (
                        <p className="text-[#4c739a] dark:text-slate-400 text-base font-normal pl-[36px]">
                            Gerencie todas as atividades, filtre por especialidade e controle recorrências.
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={() => setShowMeetingModal(true)}
                        className="flex items-center gap-2 bg-white dark:bg-slate-800 text-primary border border-primary/20 hover:border-primary/50 font-bold py-2.5 px-6 rounded-xl shadow-sm transition-all active:scale-95 whitespace-nowrap"
                    >
                        <span className="material-symbols-outlined">event</span>
                        Agendar Reunião
                    </button>
                    <button
                        onClick={handleCreateNew}
                        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95 whitespace-nowrap"
                    >
                        <span className="material-symbols-outlined">add</span>
                        Nova Tarefa
                    </button>
                </div>
            </div>

            {isTarefasOpen && (
                <>
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#e7edf3] dark:border-slate-800 shadow-sm p-4 flex flex-col gap-4">
                {/* Search Bar */}
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]">
                        search
                    </span>
                    <input
                        type="text"
                        placeholder="Buscar por nome, graduação ou especialidade..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-none text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
                    />
                </div>

                {/* Filters Row */}
                <div className="flex flex-wrap items-center gap-3 md:gap-6 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
                    {/* Specialties */}
                    <div className="flex items-center gap-2">
                        {["BCT", "AIS", "CTA", "TAAM"].map((spec) => (
                            <button
                                key={spec}
                                onClick={() => {
                                    setFilterSpecialties((prev) =>
                                        prev.includes(spec)
                                            ? prev.filter((s) => s !== spec)
                                            : [...prev, spec]
                                    );
                                }}
                                className={`
                                    px-4 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap
                                    ${
                                    filterSpecialties.includes(spec)
                                        ? "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400"
                                        : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                                }
                                `}
                            >
                                {spec}
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden md:block">
                    </div>

                    {/* Periodicities */}
                    <div className="flex items-center gap-2">
                        {[
                            { id: "diaria", label: "Diária" },
                            { id: "semanal", label: "Semanal" },
                            { id: "quinzenal", label: "Quinzenal" },
                            { id: "mensal", label: "Mensal" },
                            { id: "temporada", label: "Temporada" },
                            { id: "pontual", label: "Pontual" },
                        ].map((period) => (
                            <button
                                key={period.id}
                                onClick={() => {
                                    setFilterPeriodicities((prev) =>
                                        prev.includes(period.id)
                                            ? prev.filter((p) =>
                                                p !== period.id
                                            )
                                            : [...prev, period.id]
                                    );
                                }}
                                className={`
                                    px-4 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap
                                    ${
                                    filterPeriodicities.includes(period.id)
                                        ? "bg-white border-primary text-primary shadow-sm dark:bg-slate-800 dark:border-primary dark:text-primary"
                                        : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                                }
                                `}
                            >
                                {period.label}
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden md:block">
                    </div>

                    {/* Reset Button */}
                    <button
                        onClick={() => {
                            setFilterSpecialties([]);
                            setFilterPeriodicities([]);
                            setFilterStatuses([]);
                            setSelectedYear(new Date().getFullYear());
                            setCurrentPage(1);
                            setSearchTerm("");
                        }}
                        className="px-4 py-1.5 rounded-full text-xs font-bold bg-primary text-white hover:bg-primary/90 transition-colors shadow-md shadow-primary/20 flex items-center gap-1 whitespace-nowrap"
                    >
                        Todas
                        <span className="material-symbols-outlined text-[14px]">
                            close
                        </span>
                    </button>

                    {/* Statuses */}
                    <div className="flex items-center gap-2">
                        {[
                            { id: "pendente", label: "Pendente" },
                            { id: "iniciada", label: "Em Andamento" },
                            { id: "concluida", label: "Concluída" },
                            // { id: 'pausada', label: 'Pausada' }
                        ].map((status) => (
                            <button
                                key={status.id}
                                onClick={() => {
                                    setFilterStatuses((prev) =>
                                        prev.includes(status.id)
                                            ? prev.filter((s) =>
                                                s !== status.id
                                            )
                                            : [...prev, status.id]
                                    );
                                }}
                                className={`
                                    px-4 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap
                                    ${
                                    filterStatuses.includes(status.id)
                                        ? "bg-slate-800 border-slate-800 text-white dark:bg-white dark:border-white dark:text-slate-900"
                                        : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400"
                                }
                                `}
                            >
                                {status.label}
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden md:block">
                    </div>

                    {/* Year Select */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-[#4c739a] uppercase tracking-wider">
                            Ano:
                        </span>
                        <select
                            value={selectedYear}
                            onChange={(e) => {
                                setSelectedYear(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="bg-white dark:bg-slate-800 border-none w-[70px] rounded-lg px-2 py-1 text-xs font-bold text-[#0d141b] dark:text-white focus:outline-none ring-1 ring-slate-200 dark:ring-slate-700"
                        >
                            {[2022, 2023, 2024, 2025, 2026].map((year) => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-[#e7edf3] dark:border-slate-800 text-[#4c739a] dark:text-slate-400 text-xs uppercase tracking-wider">
                                <th
                                    className="p-2 md:p-4 font-bold cursor-pointer hover:text-primary transition-colors group/th"
                                    onClick={() => handleSort("name")}
                                >
                                    <div className="flex items-center gap-1">
                                        Nome
                                        <span
                                            className={`material-symbols-outlined text-[14px] transition-transform ${
                                                sortField === "name"
                                                    ? "text-primary"
                                                    : "opacity-0 group-hover/th:opacity-50"
                                            } ${
                                                sortField === "name" &&
                                                    sortDirection === "desc"
                                                    ? "rotate-180"
                                                    : ""
                                            }`}
                                        >
                                            arrow_upward
                                        </span>
                                    </div>
                                </th>
                                <th
                                    className="p-2 md:p-4 font-bold cursor-pointer hover:text-primary transition-colors group/th hidden md:table-cell"
                                    onClick={() => handleSort("periodicity")}
                                >
                                    <div className="flex items-center gap-1">
                                        Periodicidade
                                        <span
                                            className={`material-symbols-outlined text-[14px] transition-transform ${
                                                sortField === "periodicity"
                                                    ? "text-primary"
                                                    : "opacity-0 group-hover/th:opacity-50"
                                            } ${
                                                sortField === "periodicity" &&
                                                    sortDirection === "desc"
                                                    ? "rotate-180"
                                                    : ""
                                            }`}
                                        >
                                            arrow_upward
                                        </span>
                                    </div>
                                </th>
                                <th
                                    className="p-2 md:p-4 font-bold cursor-pointer hover:text-primary transition-colors group/th"
                                    onClick={() => handleSort("start_date")}
                                >
                                    <div className="flex items-center gap-1">
                                        Início
                                        <span
                                            className={`material-symbols-outlined text-[14px] transition-transform ${
                                                sortField === "start_date"
                                                    ? "text-primary"
                                                    : "opacity-0 group-hover/th:opacity-50"
                                            } ${
                                                sortField === "start_date" &&
                                                    sortDirection === "desc"
                                                    ? "rotate-180"
                                                    : ""
                                            }`}
                                        >
                                            arrow_upward
                                        </span>
                                    </div>
                                </th>
                                <th
                                    className="p-2 md:p-4 font-bold cursor-pointer hover:text-primary transition-colors group/th hidden md:table-cell"
                                    onClick={() => handleSort("assigned_to")}
                                >
                                    <div className="flex items-center gap-1">
                                        Membro
                                        <span
                                            className={`material-symbols-outlined text-[14px] transition-transform ${
                                                sortField === "assigned_to"
                                                    ? "text-primary"
                                                    : "opacity-0 group-hover/th:opacity-50"
                                            } ${
                                                sortField === "assigned_to" &&
                                                    sortDirection === "desc"
                                                    ? "rotate-180"
                                                    : ""
                                            }`}
                                        >
                                            arrow_upward
                                        </span>
                                    </div>
                                </th>
                                <th
                                    className="p-2 md:p-4 font-bold cursor-pointer hover:text-primary transition-colors group/th"
                                    onClick={() => handleSort("status")}
                                >
                                    <div className="flex items-center gap-1">
                                        Status
                                        <span
                                            className={`material-symbols-outlined text-[14px] transition-transform ${
                                                sortField === "status"
                                                    ? "text-primary"
                                                    : "opacity-0 group-hover/th:opacity-50"
                                            } ${
                                                sortField === "status" &&
                                                    sortDirection === "desc"
                                                    ? "rotate-180"
                                                    : ""
                                            }`}
                                        >
                                            arrow_upward
                                        </span>
                                    </div>
                                </th>
                                <th className="p-2 md:p-4 font-bold text-right">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e7edf3] dark:divide-slate-800">
                            {displayedTasks.length > 0
                                ? (
                                    displayedTasks.map((task) => (
                                        <tr
                                            key={task.id}
                                            className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                        >
                                            <td className="p-2 md:p-4">
                                                <p
                                                    className={`text-sm font-bold text-[#0d141b] dark:text-white inline-block ${
                                                        getTaskHighlight(task)
                                                    }`}
                                                >
                                                    {task.name}
                                                </p>
                                                <div className="flex gap-1 mt-1">
                                                    {task.specialties?.map(
                                                        (s) => (
                                                            <span
                                                                key={s}
                                                                className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[#4c739a] font-bold"
                                                            >
                                                                {s}
                                                            </span>
                                                        ),
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-2 md:p-4 text-sm text-[#4c739a] dark:text-slate-300 hidden md:table-cell">
                                                {formatPeriodicity(
                                                    task.periodicity,
                                                )}
                                                {task.recurrence_active && (
                                                    <span
                                                        className="ml-1 text-[10px] text-green-600 font-bold"
                                                        title="Recorrência Ativa"
                                                    >
                                                        ↺
                                                    </span>
                                                )}
                                                {!task.recurrence_active &&
                                                    [
                                                        "diaria",
                                                        "semanal",
                                                        "quinzenal",
                                                        "mensal",
                                                    ].includes(
                                                        task.periodicity,
                                                    ) && (
                                                    <span
                                                        className="ml-1 text-[10px] text-red-400 font-bold"
                                                        title="Recorrência Parada"
                                                    >
                                                        ✕
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-2 md:p-4 text-xs md:text-sm text-[#4c739a] dark:text-slate-300">
                                                {task.start_date
                                                    ? task.start_date.split(
                                                        "T",
                                                    )[0].split("-").reverse()
                                                        .join("/")
                                                    : "-"}
                                            </td>
                                            <td className="p-2 md:p-4 text-sm text-[#4c739a] dark:text-slate-300 hidden md:table-cell">
                                                {getMemberName(
                                                    task.assigned_to,
                                                )}
                                            </td>
                                            <td className="p-2 md:p-4">
                                                <span
                                                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                                        getStatusStyle(
                                                            task.status,
                                                        )
                                                    }`}
                                                >
                                                    {getStatusLabel(
                                                        task.status,
                                                    )}
                                                </span>
                                            </td>
                                            <td className="p-2 md:p-4">
                                                <div className="flex items-center justify-end gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() =>
                                                            handleEdit(task)}
                                                        className="p-2 text-[#4c739a] hover:bg-white hover:text-primary dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-[#e7edf3] hover:shadow-sm"
                                                        title="Editar"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">
                                                            edit
                                                        </span>
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            handleClone(task)}
                                                        className="p-2 text-[#4c739a] hover:bg-white hover:text-blue-600 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-[#e7edf3] hover:shadow-sm"
                                                        title="Clonar"
                                                    >
                                                        <span className="material-symbols-outlined text-[18px]">
                                                            content_copy
                                                        </span>
                                                    </button>
                                                    {task.recurrence_active && (
                                                        <button
                                                            onClick={() =>
                                                                handleToggleRecurrence(
                                                                    task,
                                                                )}
                                                            className="p-2 text-[#4c739a] hover:bg-white hover:text-amber-600 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-[#e7edf3] hover:shadow-sm"
                                                            title="Interromper Recorrência"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">
                                                                event_busy
                                                            </span>
                                                        </button>
                                                    )}
                                                    {!task.recurrence_active &&
                                                        [
                                                            "diaria",
                                                            "semanal",
                                                            "quinzenal",
                                                            "mensal",
                                                        ].includes(
                                                            task.periodicity,
                                                        ) && (
                                                        <button
                                                            onClick={() =>
                                                                handleToggleRecurrence(
                                                                    task,
                                                                )}
                                                            className="p-2 text-[#4c739a] hover:bg-white hover:text-green-600 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-[#e7edf3] hover:shadow-sm"
                                                            title="Ativar Recorrência"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">
                                                                update
                                                            </span>
                                                        </button>
                                                    )}
                                                    {canDelete() && (
                                                        <button
                                                            onClick={() =>
                                                                handleDelete(
                                                                    task,
                                                                )}
                                                            className="p-2 text-[#4c739a] hover:bg-red-100 hover:text-red-600 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-[#e7edf3] hover:shadow-sm"
                                                        >
                                                            <span className="material-symbols-outlined text-[16px]">
                                                                delete
                                                            </span>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )
                                : (
                                    <tr>
                                        <td
                                            colSpan={6}
                                            className="p-8 text-center text-[#4c739a] text-sm italic"
                                        >
                                            Nenhuma tarefa encontrada com os
                                            filtros atuais.
                                        </td>
                                    </tr>
                                )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                {totalCount > 0 && (
                    <div className="flex items-center justify-between border-t border-[#e7edf3] dark:divide-slate-800 pt-4 mt-2">
                        <div className="text-xs text-[#4c739a] font-medium">
                            Mostrando{" "}
                            <span className="font-bold text-[#0d141b] dark:text-white">
                                {(currentPage - 1) * itemsPerPage + 1}
                            </span>{" "}
                            a{" "}
                            <span className="font-bold text-[#0d141b] dark:text-white">
                                {Math.min(
                                    currentPage * itemsPerPage,
                                    totalCount,
                                )}
                            </span>{" "}
                            de{" "}
                            <span className="font-bold text-[#0d141b] dark:text-white">
                                {totalCount}
                            </span>{" "}
                            tarefas
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() =>
                                    setCurrentPage((prev) =>
                                        Math.max(1, prev - 1)
                                    )}
                                disabled={currentPage === 1}
                                className="p-2 rounded-lg border border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-slate-900 text-[#4c739a] hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <span className="material-symbols-outlined text-[20px]">
                                    chevron_left
                                </span>
                            </button>

                            {[...Array(Math.min(5, totalPages))].map((_, i) => (
                                <button
                                    key={i + 1}
                                    onClick={() => setCurrentPage(i + 1)}
                                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                                        currentPage === i + 1
                                            ? "bg-primary text-white"
                                            : "hover:bg-slate-100 dark:hover:bg-slate-800 text-[#4c739a]"
                                    }`}
                                >
                                    {i + 1}
                                </button>
                            ))}

                            <button
                                onClick={() =>
                                    setCurrentPage((prev) =>
                                        Math.min(totalPages, prev + 1)
                                    )}
                                disabled={currentPage >= totalPages}
                                className="p-2 rounded-lg border border-[#e7edf3] dark:border-slate-800 bg-white dark:bg-slate-900 text-[#4c739a] hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <span className="material-symbols-outlined text-[20px]">
                                    chevron_right
                                </span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
            </>
            )}

            {/* Meetings List Section */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#e7edf3] dark:border-slate-800 shadow-sm p-4 mt-4 md:mt-8 flex flex-col gap-4">
                <button 
                    onClick={() => setIsReunioesOpen(!isReunioesOpen)}
                    className="flex items-center gap-3 mb-2 hover:opacity-80 transition-opacity w-fit text-left"
                >
                    <span className="material-symbols-outlined text-[28px] text-primary">
                        {isReunioesOpen ? "expand_less" : "expand_more"}
                    </span>
                    <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 rounded-lg">
                        <span className="material-symbols-outlined">
                            event
                        </span>
                    </div>
                    <h2 className="text-xl font-extrabold text-[#0d141b] dark:text-white">
                        Lista de Reuniões
                    </h2>
                </button>

                {isReunioesOpen && (
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="border-b-2 border-[#e7edf3] dark:border-slate-800 text-[#4c739a] dark:text-slate-400 text-[10px] uppercase font-black tracking-widest">
                                <th className="py-4 px-4">Assunto</th>
                                <th className="py-4 px-4">Início</th>
                                <th className="py-4 px-4">Fim</th>
                                <th className="py-4 px-4 text-center">
                                    Convocados
                                </th>
                                <th className="py-4 px-4 text-center">
                                    Ações
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#e7edf3] dark:divide-slate-800/50">
                            {meetings.length > 0
                                ? (
                                    meetings.map((meeting) => (
                                        <tr
                                            key={meeting.id}
                                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                                        >
                                            <td className="py-4 px-4">
                                                <div className="flex flex-col gap-1">
                                                    <span className="font-bold text-[#0d141b] dark:text-white text-sm">
                                                        {meeting.assunto}
                                                    </span>
                                                    {meeting.link && (
                                                        <a
                                                            href={meeting
                                                                .link}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-primary text-[11px] font-bold hover:underline flex items-center gap-1"
                                                        >
                                                            <span className="material-symbols-outlined text-[12px]">
                                                                link
                                                            </span>{" "}
                                                            Abrir Link
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="text-sm text-[#4c739a] dark:text-slate-300 font-medium">
                                                    {new Date(
                                                        meeting.inicio,
                                                    ).toLocaleString(
                                                        "pt-BR",
                                                        {
                                                            day: "2-digit",
                                                            month: "2-digit",
                                                            year: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        },
                                                    )}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="text-sm text-[#4c739a] dark:text-slate-300 font-medium">
                                                    {new Date(meeting.fim)
                                                        .toLocaleString(
                                                            "pt-BR",
                                                            {
                                                                day: "2-digit",
                                                                month:
                                                                    "2-digit",
                                                                year: "numeric",
                                                                hour: "2-digit",
                                                                minute:
                                                                    "2-digit",
                                                            },
                                                        )}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-center">
                                                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-[#4c739a] dark:text-slate-300 text-[11px] font-bold rounded-full">
                                                    {meeting.membros
                                                        ?.length || 0} Membros
                                                </span>
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() =>
                                                            handleEditMeeting(
                                                                meeting,
                                                            )}
                                                        className="p-1.5 rounded-lg text-[#4c739a] hover:bg-primary/10 hover:text-primary transition-colors"
                                                        title="Editar Reunião"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">
                                                            edit
                                                        </span>
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            handleCloneMeeting(
                                                                meeting,
                                                            )}
                                                        className="p-1.5 rounded-lg text-[#4c739a] hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                                        title="Clonar Reunião"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">
                                                            content_copy
                                                        </span>
                                                    </button>
                                                    <button
                                                        onClick={() =>
                                                            handleDeleteMeeting(
                                                                meeting,
                                                            )}
                                                        className="p-1.5 rounded-lg text-[#4c739a] hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30 transition-colors"
                                                        title="Apagar Reunião"
                                                    >
                                                        <span className="material-symbols-outlined text-[20px]">
                                                            delete
                                                        </span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )
                                : (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="py-12 text-center text-[#4c739a] dark:text-slate-500 text-sm"
                                        >
                                            Nenhuma reunião encontrada.
                                        </td>
                                    </tr>
                                )}
                        </tbody>
                    </table>
                </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            {taskToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-[#e7edf3] dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 text-center">
                            <div className="size-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-red-500 text-[32px]">
                                    delete_forever
                                </span>
                            </div>
                            <h3 className="text-xl font-bold text-[#0d141b] dark:text-white mb-2">
                                Confirmar Exclusão
                            </h3>
                            <p className="text-[#4c739a] dark:text-slate-400">
                                Tem certeza que deseja deletar a tarefa{" "}
                                <span className="font-bold text-[#0d141b] dark:text-white">
                                    "{taskToDelete.name}"
                                </span>?
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
                                {loading
                                    ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white">
                                        </div>
                                    )
                                    : (
                                        "Excluir Registro"
                                    )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Meeting Confirmation Modal */}
            {meetingToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-[#e7edf3] dark:border-slate-800 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 text-center">
                            <div className="size-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
                                <span className="material-symbols-outlined text-red-500 text-[32px]">
                                    delete_forever
                                </span>
                            </div>
                            <h3 className="text-xl font-bold text-[#0d141b] dark:text-white mb-2">
                                Confirmar Exclusão
                            </h3>
                            <p className="text-[#4c739a] dark:text-slate-400">
                                Tem certeza que deseja deletar a reunião{" "}
                                <span className="font-bold text-[#0d141b] dark:text-white">
                                    "{meetingToDelete.assunto}"
                                </span>?
                                <br />Esta ação não pode ser desfeita.
                            </p>
                        </div>
                        <div className="flex p-4 gap-3 bg-[#f8fafc] dark:bg-slate-800/50">
                            <button
                                onClick={() => setMeetingToDelete(null)}
                                className="flex-1 px-4 py-3 rounded-xl border border-[#cfdbe7] dark:border-slate-700 text-sm font-bold text-[#4c739a] hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDeleteMeeting}
                                className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold shadow-lg shadow-red-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                                disabled={loading}
                            >
                                {loading
                                    ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white">
                                        </div>
                                    )
                                    : (
                                        "Excluir Registro"
                                    )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Meeting Modal */}
            {showMeetingModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-[#e7edf3] dark:border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-[#e7edf3] dark:border-slate-800 flex justify-between items-center bg-[#f8fafc] dark:bg-slate-800/50">
                            <h3 className="text-xl font-bold text-[#0d141b] dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">
                                    event
                                </span>
                                Agendar Reunião
                            </h3>
                            <button
                                onClick={() => {
                                    setShowMeetingModal(false);
                                    setEditingMeetingId(null);
                                    setMeetingData({
                                        assunto: "",
                                        inicio: "",
                                        fim: "",
                                        link: "",
                                    });
                                    setMeetingMembers([]);
                                }}
                                className="p-1 text-[#4c739a] hover:text-[#0d141b] dark:hover:text-white transition-colors"
                            >
                                <span className="material-symbols-outlined">
                                    close
                                </span>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                            <form
                                id="meetingForm"
                                onSubmit={handleScheduleMeeting}
                                className="flex flex-col gap-4"
                            >
                                <div className="flex flex-col gap-2">
                                    <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                        Assunto
                                    </label>
                                    <input
                                        required
                                        type="text"
                                        value={meetingData.assunto}
                                        onChange={(e) =>
                                            setMeetingData({
                                                ...meetingData,
                                                assunto: e.target.value,
                                            })}
                                        className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3"
                                        placeholder="Ex: Reunião de Alinhamento"
                                    />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                            Início
                                        </label>
                                        <input
                                            required
                                            type="datetime-local"
                                            value={meetingData.inicio}
                                            onChange={(e) =>
                                                setMeetingData({
                                                    ...meetingData,
                                                    inicio: e.target.value,
                                                })}
                                            className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3"
                                        />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                            Fim
                                        </label>
                                        <input
                                            required
                                            type="datetime-local"
                                            value={meetingData.fim}
                                            onChange={(e) =>
                                                setMeetingData({
                                                    ...meetingData,
                                                    fim: e.target.value,
                                                })}
                                            className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3"
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
                                            setMeetingData({
                                                ...meetingData,
                                                link: e.target.value,
                                            })}
                                        className="w-full rounded-lg border border-[#cfdbe7] dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:ring-primary focus:border-primary p-3"
                                        placeholder="Ex: https://meet.google.com/abc-defg-hij"
                                    />
                                </div>

                                <div className="flex flex-col gap-2 mt-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[#0d141b] dark:text-white text-sm font-semibold">
                                            Membros Convocados
                                        </label>
                                        <span className="text-xs text-primary font-bold">
                                            {meetingMembers.length}{" "}
                                            selecionado(s)
                                        </span>
                                    </div>

                                    {/* O filtro do currentUser foi removido daqui, tornando os botões públicos */}
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {/* BOTÃO CAPACIDADE: Filtra CP e CH */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const cpMembers =
                                                    meetingAvailableMembers
                                                        .filter((m) =>
                                                            m.sector === "CP" ||
                                                            m.sector === "CH"
                                                        )
                                                        .map((m) => m.id);
                                                setMeetingMembers([
                                                    ...new Set([
                                                        ...meetingMembers,
                                                        ...cpMembers,
                                                    ]),
                                                ]);
                                            }}
                                            className="px-3 py-1.5 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-bold transition-colors"
                                        >
                                            Capacidade
                                        </button>

                                        {/* BOTÃO ESPAÇO AÉREO: Filtra EA e CH */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const eaMembers =
                                                    meetingAvailableMembers
                                                        .filter((m) =>
                                                            m.sector === "EA" ||
                                                            m.sector === "CH"
                                                        )
                                                        .map((m) => m.id);
                                                setMeetingMembers([
                                                    ...new Set([
                                                        ...meetingMembers,
                                                        ...eaMembers,
                                                    ]),
                                                ]);
                                            }}
                                            className="px-3 py-1.5 rounded bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-bold transition-colors"
                                        >
                                            Espaço Aéreo
                                        </button>

                                        {/* BOTÃO SUBDIVISÃO ESTRATÉGICA: Mantém todos */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMeetingMembers(
                                                    meetingAvailableMembers.map(
                                                        (m) => m.id,
                                                    ),
                                                );
                                            }}
                                            className="px-3 py-1.5 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 text-xs font-bold transition-colors"
                                        >
                                            Subdivisão Estratégica
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-[#e7edf3] dark:border-slate-700 rounded-xl p-3 max-h-48 overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-slate-800/30">
                                        {meetingAvailableMembers.map((
                                            member,
                                        ) => (
                                            <label
                                                key={member.id}
                                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-[#e7edf3] dark:hover:border-slate-700 transition-all cursor-pointer"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={meetingMembers
                                                        .includes(member.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setMeetingMembers([
                                                                ...meetingMembers,
                                                                member.id,
                                                            ]);
                                                        } else {
                                                            setMeetingMembers(
                                                                meetingMembers
                                                                    .filter(
                                                                        (id) =>
                                                                            id !==
                                                                                member
                                                                                    .id,
                                                                    ),
                                                            );
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                                                />
                                                <div className="flex items-center gap-2">
                                                    <img
                                                        src={member.avatar ||
                                                            "https://ui-avatars.com/api/?name=" +
                                                                member.name}
                                                        alt={member.name}
                                                        className="w-6 h-6 rounded-full"
                                                    />
                                                    <span className="text-xs font-bold text-[#0d141b] dark:text-slate-300 line-clamp-1">
                                                        {member.abrev ||
                                                            member.rank}{" "}
                                                        {member.war_name ||
                                                            member.name}
                                                    </span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div className="flex p-4 gap-3 bg-[#f8fafc] dark:bg-slate-800/50 border-t border-[#e7edf3] dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowMeetingModal(false);
                                    setEditingMeetingId(null);
                                    setMeetingData({
                                        assunto: "",
                                        inicio: "",
                                        fim: "",
                                        link: "",
                                    });
                                    setMeetingMembers([]);
                                }}
                                className="flex-1 px-4 py-3 rounded-xl border border-[#cfdbe7] dark:border-slate-700 text-sm font-bold text-[#4c739a] hover:bg-white dark:hover:bg-slate-800 transition-all active:scale-95"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                form="meetingForm"
                                className="flex-1 px-4 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white text-sm font-bold shadow-lg shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                                disabled={loading}
                            >
                                {loading
                                    ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white">
                                        </div>
                                    )
                                    : (
                                        "Agendar"
                                    )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Meetings Widget for CH Sector */}
            {currentUser?.sector === "CH" && upcomingMeetings.length > 0 && (
                <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 animate-in fade-in slide-in-from-bottom-10 duration-500">
                    {/* Expanded Panel */}
                    {isMeetingsExpanded && (
                        <div className="bg-[#f8fafc] dark:bg-slate-900 border border-[#e7edf3] dark:border-slate-800 p-4 rounded-2xl shadow-2xl w-80 max-h-[60vh] overflow-y-auto custom-scrollbar flex flex-col gap-3 relative animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="font-extrabold text-[#0d141b] dark:text-white flex items-center gap-2">
                                    <span className="material-symbols-outlined text-yellow-500">
                                        event
                                    </span>
                                    Reuniões Agendadas
                                </h3>
                                <button
                                    onClick={() => setIsMeetingsExpanded(false)}
                                    className="p-1 rounded-full text-[#4c739a] hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[18px]">
                                        close
                                    </span>
                                </button>
                            </div>

                            {upcomingMeetings.map((m) => (
                                <div
                                    key={m.id}
                                    onClick={() =>
                                        m.link
                                            ? window.open(m.link, "_blank")
                                            : undefined}
                                    className={`bg-yellow-200 dark:bg-yellow-900/60 text-yellow-900 dark:text-yellow-100 p-4 rounded-xl shadow-md transition-transform relative ${
                                        m.link
                                            ? "cursor-pointer hover:shadow-lg hover:scale-105"
                                            : ""
                                    }`}
                                >
                                    <div className="absolute top-2 right-2 w-3 h-3 bg-red-400 dark:bg-red-500 rounded-full shadow-sm opacity-80">
                                    </div>
                                    <h4 className="font-bold text-sm leading-tight mb-2 pr-4 break-words">
                                        {m.assunto}
                                    </h4>
                                    <div className="flex flex-col gap-1 text-[11px] font-semibold opacity-80">
                                        <span className="flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">
                                                event
                                            </span>{" "}
                                            Início:
                                            {new Date(m.inicio).toLocaleString(
                                                "pt-BR",
                                                {
                                                    day: "2-digit",
                                                    month: "2-digit",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                },
                                            )}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[14px]">
                                                event_busy
                                            </span>
                                            Fim:
                                            {new Date(m.fim).toLocaleString(
                                                "pt-BR",
                                                {
                                                    day: "2-digit",
                                                    month: "2-digit",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                },
                                            )}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Floating Action Button */}
                    <button
                        onClick={() =>
                            setIsMeetingsExpanded(!isMeetingsExpanded)}
                        className="w-14 h-14 bg-primary hover:bg-primary/90 text-white rounded-full shadow-xl flex items-center justify-center transition-transform active:scale-95 hover:scale-105 relative"
                        title="Ver reuniões"
                    >
                        <span className="material-symbols-outlined text-[28px]">
                            {isMeetingsExpanded
                                ? "keyboard_arrow_down"
                                : "calendar_month"}
                        </span>
                        {!isMeetingsExpanded && upcomingMeetings.length > 0 && (
                            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-md animate-bounce">
                                {upcomingMeetings.length}
                            </span>
                        )}
                    </button>
                </div>
            )}

            {/* Strategic Summary Fullscreen Popup Overlay */}
            {isStrategicSummaryOpen && (() => {
                const { timeStr, dateStr } = getUTC3DateTime(currentTime);
                const userSector = currentUser?.sector || "SE";
                const sectorFullName = userSector === "CP"
                    ? "SEÇÃO DE CAPACIDADE ATC"
                    : userSector === "EA"
                    ? "SEÇÃO DE ESPAÇO AÉREO"
                    : userSector === "CH"
                    ? "CHEFIA"
                    : "SUBDIVISÃO ESTRATÉGICA";

                const loggedUserLabel = currentUser
                    ? `${currentUser.rank || ""} ${currentUser.war_name || ""}`
                        .trim()
                    : "OPERADOR";

                // Tab items for slideshow progress / navigation
                const tabs = [
                    { num: "01", label: "Controle Efetivo" },
                    { num: "02", label: "Projetos em Andamento" },
                    { num: "03", label: "D-10 • Próximos Eventos" },
                    { num: "04", label: "Reuniões da Seção" },
                ];

                return (
                    <div className="fixed inset-0 z-[999] bg-[#0c1322] text-white flex flex-col font-sans overflow-hidden animate-in fade-in duration-300">
                        {/* Kiosk Background Decorative Glows */}
                        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#cda250]/5 rounded-full blur-[140px] pointer-events-none" />
                        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[140px] pointer-events-none" />

                        {/* Top Header - Kiosk Style */}
                        <div className="bg-[#0f192b] border-b border-[#1d2d44] px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 relative z-10 shadow-lg">
                            <div className="flex items-center gap-3">
                                {/* Gold Circular Avatar sector label */}
                                <div className="w-12 h-12 rounded-full border-2 border-[#cda250] flex items-center justify-center font-bold text-base text-[#cda250] bg-[#132039] shadow-inner">
                                    {userSector}
                                </div>
                                <div>
                                    <h1 className="text-xl md:text-2xl font-serif font-bold text-white tracking-wide leading-tight">
                                        Painel Gerencial
                                    </h1>
                                    <p className="text-[10px] md:text-xs text-[#cda250] font-bold uppercase tracking-wider">
                                        {sectorFullName} • {loggedUserLabel}
                                    </p>
                                </div>
                            </div>

                            {/* Clock in real time */}
                            <div className="flex flex-col items-center">
                                <span className="text-3xl md:text-4xl font-black font-mono tracking-widest text-white leading-none">
                                    {timeStr}
                                </span>
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                                    {dateStr}
                                </span>
                            </div>

                            {/* Slide Controls and Close Button */}
                            <div className="flex items-center gap-3">
                                <div className="flex items-center bg-[#132039] border border-[#1d2d44] rounded-lg p-1">
                                    <button
                                        onClick={() =>
                                            setCurrentSlide((prev) =>
                                                (prev - 1 + 4) % 4
                                            )}
                                        className="p-1.5 rounded hover:bg-slate-800 transition-colors text-slate-300"
                                        title="Slide Anterior"
                                    >
                                        <span className="material-symbols-outlined text-[20px] block">
                                            navigate_before
                                        </span>
                                    </button>
                                    <button
                                        onClick={() =>
                                            setIsSlidePaused(!isSlidePaused)}
                                        className="p-1.5 rounded hover:bg-slate-800 transition-colors text-[#cda250]"
                                        title={isSlidePaused
                                            ? "Retomar Slideshow"
                                            : "Pausar Slideshow"}
                                    >
                                        <span className="material-symbols-outlined text-[20px] block">
                                            {isSlidePaused
                                                ? "play_arrow"
                                                : "pause"}
                                        </span>
                                    </button>
                                    <button
                                        onClick={() =>
                                            setCurrentSlide((prev) =>
                                                (prev + 1) % 4
                                            )}
                                        className="p-1.5 rounded hover:bg-slate-800 transition-colors text-slate-300"
                                        title="Próximo Slide"
                                    >
                                        <span className="material-symbols-outlined text-[20px] block">
                                            navigate_next
                                        </span>
                                    </button>
                                </div>

                                <button
                                    onClick={() =>
                                        setIsStrategicSummaryOpen(false)}
                                    className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/25 text-red-400 border border-red-500/30 transition-colors"
                                    title="Fechar Painel"
                                >
                                    <span className="material-symbols-outlined text-[20px] block">
                                        close
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Custom Tab Progress Navigation Bar */}
                        <div className="bg-[#0c1424] border-b border-[#17243c] px-6 py-2.5 flex items-center justify-around md:justify-start gap-6 md:gap-12 relative z-10">
                            {tabs.map((tab, idx) => {
                                const isActive = currentSlide === idx;
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentSlide(idx)}
                                        className="flex items-center gap-2 text-left relative py-1 focus:outline-none group transition-all"
                                    >
                                        <span
                                            className={`text-[10px] font-bold font-mono tracking-wider ${
                                                isActive
                                                    ? "text-[#cda250]"
                                                    : "text-slate-500"
                                            }`}
                                        >
                                            {tab.num}
                                        </span>
                                        <span
                                            className={`text-xs md:text-sm font-semibold tracking-tight transition-colors ${
                                                isActive
                                                    ? "text-white font-bold"
                                                    : "text-slate-400 group-hover:text-slate-200"
                                            }`}
                                        >
                                            {tab.label}
                                        </span>
                                        {isActive && (
                                            <div className="absolute bottom-[-11px] left-0 right-0 h-0.5 bg-[#cda250] rounded-full shadow-lg" />
                                        )}
                                    </button>
                                );
                            })}

                            {/* Autoplay Slide Progress indicator inside active tab */}
                            {!isSlidePaused && (
                                <div className="ml-auto hidden md:block w-32 h-1 bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        key={currentSlide}
                                        className="h-full bg-[#cda250] rounded-full animate-progress duration-10000"
                                        style={{
                                            animation:
                                                "progress 10s linear forwards",
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Title and Subtitle Block */}
                        <div className="px-8 pt-8 pb-4 relative z-10 flex flex-col gap-1">
                            <h2 className="text-3xl md:text-4xl font-serif font-bold text-white tracking-wide">
                                {currentSlide === 0 && "Controle do Efetivo"}
                                {currentSlide === 1 && "Projetos em Andamento"}
                                {currentSlide === 2 &&
                                    "D-10 — Eventos dos Próximos 10 Dias"}
                                {currentSlide === 3 && "Reuniões da Seção"}
                            </h2>
                            <p className="text-xs md:text-sm text-[#cda250] font-medium tracking-wide">
                                {currentSlide === 0 &&
                                    "Status operacional e disponibilidade dos militares no momento"}
                                {currentSlide === 1 &&
                                    "Atividades e projetos sob responsabilidade da seção neste mês"}
                                {currentSlide === 2 &&
                                    `Janela: ${
                                        new Date().toLocaleDateString("pt-BR")
                                    } a ${
                                        new Date(
                                            new Date().setDate(
                                                new Date().getDate() + 10,
                                            ),
                                        ).toLocaleDateString("pt-BR")
                                    }`}
                                {currentSlide === 3 &&
                                    "Próximos compromissos agendados"}
                            </p>
                        </div>

                        {/* Slide Content Area */}
                        <div className="flex-1 overflow-y-auto relative z-10 px-8 pb-8 custom-scrollbar">
                            {currentSlide === 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
                                    {members.map((member) => {
                                        const currentMission = getMemberMission(
                                            member.id,
                                        );
                                        const currentUnavail =
                                            getMemberUnavailToday(member.id);
                                        const isUnavailable =
                                            member.status === "Indisponível" ||
                                            !!currentUnavail;
                                        const memberTasks = activeAssignedTasks
                                            .filter((t) =>
                                                t.assigned_to === member.id
                                            );

                                        let cardBg =
                                            "bg-[#131f37] border-[#1d2d44]";
                                        let borderAccent =
                                            "border-l-4 border-l-[#38bdf8]";
                                        let statusBadge = (
                                            <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                                Disponível
                                            </span>
                                        );

                                        if (currentMission) {
                                            cardBg =
                                                "bg-[#1a2035] border-[#252f4c]";
                                            borderAccent =
                                                "border-l-4 border-l-[#cda250]";
                                            statusBadge = (
                                                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#cda250]/15 text-[#cda250] border border-[#cda250]/20">
                                                    Em Viagem
                                                </span>
                                            );
                                        } else if (
                                            isUnavailable &&
                                            currentUnavail?.type === "Atividade"
                                        ) {
                                            cardBg =
                                                "bg-[#142337] border-[#1f3552]";
                                            borderAccent =
                                                "border-l-4 border-l-[#10b981]";
                                            statusBadge = (
                                                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-green-500/15 text-green-400 border border-green-500/25">
                                                    Atividade Interna
                                                </span>
                                            );
                                        } else if (isUnavailable) {
                                            cardBg =
                                                "bg-[#221c29] border-[#382b43]";
                                            borderAccent =
                                                "border-l-4 border-l-red-500";
                                            statusBadge = (
                                                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/25">
                                                    {currentUnavail
                                                        ? currentUnavail.type
                                                        : "Indisponível"}
                                                </span>
                                            );
                                        }

                                        return (
                                            <div
                                                key={member.id}
                                                className={`p-4 rounded-xl border ${cardBg} ${borderAccent} flex flex-col justify-between gap-3 shadow-md backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-full overflow-hidden border border-slate-700 bg-[#0f192b] flex items-center justify-center font-bold text-xs uppercase text-slate-300">
                                                        {member.avatar
                                                            ? (
                                                                <img
                                                                    src={member
                                                                        .avatar}
                                                                    alt={member
                                                                        .name}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            )
                                                            : (
                                                                member.name
                                                                    .substring(
                                                                        0,
                                                                        2,
                                                                    )
                                                            )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="text-sm font-extrabold text-white truncate">
                                                            {member.abrev}{" "}
                                                            {member.war_name}
                                                        </h4>
                                                        <span className="text-[10px] text-slate-400 block truncate">
                                                            {member.name}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center justify-between border-t border-[#1d2d44]/50 pt-2 mt-1">
                                                    {statusBadge}
                                                    <span className="text-[10px] text-slate-400 font-semibold">
                                                        {memberTasks.length}
                                                        {" "}
                                                        {memberTasks.length ===
                                                                1
                                                            ? "Atividade"
                                                            : "Atividades"}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {currentSlide === 1 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in duration-300">
                                    {popupPendingTasks.length > 0
                                        ? (
                                            popupPendingTasks.map(
                                                (task, idx) => {
                                                    const respMember = members
                                                        .find((m) =>
                                                            m.id ===
                                                                task.assigned_to
                                                        );
                                                    const isEven =
                                                        idx % 2 === 0;
                                                    return (
                                                        <div
                                                            key={task.id}
                                                            className={`p-5 rounded-xl border border-[#1d2d44] bg-[#131f37] flex flex-col justify-between gap-4 shadow-md ${
                                                                isEven
                                                                    ? "border-l-4 border-l-[#cda250]"
                                                                    : "border-l-4 border-l-[#3b82f6]"
                                                            }`}
                                                        >
                                                            <div>
                                                                <div className="flex items-center justify-between gap-2 mb-2">
                                                                    <span className="text-[10px] font-bold text-[#cda250] uppercase tracking-wider">
                                                                        {task
                                                                            .periodicity ||
                                                                            "Tarefa"}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                                        Prazo:
                                                                        {" "}
                                                                        {task
                                                                                .prazo_final
                                                                            ? new Date(
                                                                                task.prazo_final,
                                                                            ).toLocaleDateString(
                                                                                "pt-BR",
                                                                            )
                                                                            : "S/P"}
                                                                    </span>
                                                                </div>
                                                                <h4 className="text-base font-extrabold text-white leading-tight">
                                                                    {task.name}
                                                                </h4>
                                                                <div className="mt-3 p-3 rounded bg-[#0c1424]/60 border border-[#1c2a3f]">
                                                                    <span className="text-[9px] text-[#cda250] font-black uppercase tracking-wider block mb-1">
                                                                        Despacho
                                                                    </span>
                                                                    <p className="text-xs text-slate-300 leading-relaxed">
                                                                        {task
                                                                            .despacho ||
                                                                            (
                                                                                <span className="text-slate-500 italic">
                                                                                    Nenhum
                                                                                    despacho
                                                                                    lançado
                                                                                </span>
                                                                            )}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="border-t border-[#1d2d44]/50 pt-3 flex items-center justify-between">
                                                                <span className="text-[10px] text-slate-400 font-semibold uppercase">
                                                                    Responsável:
                                                                </span>
                                                                <span className="text-xs font-bold text-white">
                                                                    {respMember
                                                                        ? `${respMember.abrev} ${respMember.war_name}`
                                                                        : "Não designado"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                },
                                            )
                                        )
                                        : (
                                            <div className="col-span-3 py-12 text-center text-slate-500 text-sm">
                                                Nenhuma atividade pendente
                                                encontrada para este mês.
                                            </div>
                                        )}
                                </div>
                            )}

                            {currentSlide === 2 && (() => {
                                const next10Days = Array.from(
                                    { length: 10 },
                                    (_, i) => {
                                        const d = new Date();
                                        d.setDate(d.getDate() + i);
                                        return d;
                                    },
                                );

                                return (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 animate-in fade-in duration-300">
                                        {next10Days.map((date, index) => {
                                            const dateStr = date
                                                .toLocaleDateString("en-CA");
                                            const dayEvents = sdiaEvents.filter(
                                                (sdia) => {
                                                    return sdia.data_inicio <=
                                                            dateStr &&
                                                        sdia.data_fim >=
                                                            dateStr;
                                                },
                                            );

                                            const isToday = index === 0;
                                            const weekday = date
                                                .toLocaleDateString("pt-BR", {
                                                    weekday: "short",
                                                }).replace(".", "")
                                                .toUpperCase();
                                            const formattedDate = date
                                                .toLocaleDateString("pt-BR", {
                                                    day: "2-digit",
                                                    month: "2-digit",
                                                });
                                            const isEven = index % 2 === 0;

                                            return (
                                                <div
                                                    key={index}
                                                    className={`p-4 rounded-xl border flex flex-col gap-3 min-h-[160px] shadow-md transition-all duration-300 hover:border-slate-500 bg-[#131f37] border-[#1d2d44] ${
                                                        isToday
                                                            ? "border-l-4 border-l-[#cda250]"
                                                            : isEven
                                                            ? "border-l-4 border-l-[#3b82f6]"
                                                            : "border-l-4 border-l-[#cda250]/70"
                                                    }`}
                                                >
                                                    <div className="border-b border-[#1d2d44]/50 pb-2 flex items-center justify-between">
                                                        <span
                                                            className={`text-[10px] font-black tracking-wider ${
                                                                isToday
                                                                    ? "text-[#cda250]"
                                                                    : "text-slate-400"
                                                            }`}
                                                        >
                                                            {isToday
                                                                ? "HOJE"
                                                                : weekday}
                                                        </span>
                                                        <span className="text-sm font-bold text-white">
                                                            {formattedDate}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 overflow-y-auto flex flex-col gap-2 max-h-[160px] custom-scrollbar">
                                                        {dayEvents.length > 0
                                                            ? (
                                                                dayEvents.map((
                                                                    sdia,
                                                                ) => (
                                                                    <div
                                                                        key={sdia
                                                                            .id}
                                                                        className="p-2 rounded bg-[#0c1424]/60 border border-[#1a283e] flex flex-col gap-1"
                                                                    >
                                                                        <div className="text-[9px] font-mono font-bold text-[#cda250] leading-none">
                                                                            [{sdia
                                                                                .indicativo}]
                                                                        </div>
                                                                        <div className="text-xs font-semibold text-white leading-tight">
                                                                            {sdia
                                                                                .titulo_sdia}
                                                                        </div>
                                                                        {(sdia
                                                                            .impacto ||
                                                                            sdia.cap ||
                                                                            sdia.clsd) &&
                                                                            (
                                                                                <div className="flex flex-wrap gap-1 mt-1">
                                                                                    {sdia
                                                                                        .impacto &&
                                                                                        (
                                                                                            <span className="px-1 py-0.2 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[7px] font-bold uppercase tracking-wide">
                                                                                                IMP
                                                                                            </span>
                                                                                        )}
                                                                                    {sdia
                                                                                        .cap &&
                                                                                        (
                                                                                            <span className="px-1 py-0.2 rounded bg-[#cda250]/10 border border-[#cda250]/20 text-[#cda250] text-[7px] font-bold uppercase tracking-wide">
                                                                                                CAP
                                                                                            </span>
                                                                                        )}
                                                                                    {sdia
                                                                                        .clsd &&
                                                                                        (
                                                                                            <span className="px-1 py-0.2 rounded bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[7px] font-bold uppercase tracking-wide">
                                                                                                CLSD
                                                                                            </span>
                                                                                        )}
                                                                                </div>
                                                                            )}
                                                                    </div>
                                                                ))
                                                            )
                                                            : (
                                                                <span className="text-[10px] text-slate-500 italic">
                                                                    Sem eventos
                                                                </span>
                                                            )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()}

                            {currentSlide === 3 && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
                                    {popupMeetings.length > 0
                                        ? (
                                            popupMeetings.map(
                                                (meeting, idx) => {
                                                    const startDate = new Date(
                                                        meeting.inicio,
                                                    );
                                                    const startTime = startDate
                                                        .toLocaleTimeString(
                                                            "pt-BR",
                                                            {
                                                                hour: "2-digit",
                                                                minute:
                                                                    "2-digit",
                                                            },
                                                        );
                                                    const dayMonthStr =
                                                        startDate
                                                            .toLocaleDateString(
                                                                "pt-BR",
                                                                {
                                                                    day: "2-digit",
                                                                    month:
                                                                        "2-digit",
                                                                },
                                                            );
                                                    const rawWeekday = startDate
                                                        .toLocaleDateString(
                                                            "pt-BR",
                                                            {
                                                                weekday:
                                                                    "short",
                                                            },
                                                        );
                                                    const weekdayStr =
                                                        rawWeekday.charAt(0)
                                                            .toUpperCase() +
                                                        rawWeekday.slice(1)
                                                            .replace(".", "");
                                                    const formattedDate =
                                                        `${dayMonthStr} - ${weekdayStr}`;

                                                    // Map members convocados
                                                    const summonedMembers =
                                                        meeting.membros || [];
                                                    const summonedDetails =
                                                        members.filter((m) =>
                                                            summonedMembers
                                                                .includes(m.id)
                                                        );
                                                    const isEven =
                                                        idx % 2 === 0;

                                                    return (
                                                        <div
                                                            key={meeting.id}
                                                            className={`p-5 rounded-xl border border-[#1d2d44] bg-[#131f37] flex flex-col justify-between gap-4 shadow-md transition-all duration-300 hover:border-slate-650 ${
                                                                isEven
                                                                    ? "border-l-4 border-l-[#cda250]"
                                                                    : "border-l-4 border-l-[#3b82f6]"
                                                            }`}
                                                        >
                                                            <div>
                                                                <div className="flex items-center justify-between gap-2 mb-2">
                                                                    <span className="text-sm font-bold text-[#cda250] font-mono leading-none">
                                                                        {startTime}
                                                                    </span>
                                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                                        {formattedDate}
                                                                    </span>
                                                                </div>
                                                                <h4 className="text-base font-extrabold text-white leading-tight font-serif">
                                                                    {meeting
                                                                        .assunto}
                                                                </h4>
                                                                {meeting.link &&
                                                                    (
                                                                        <div className="mt-2.5 p-2 rounded bg-[#0c1424]/40 border border-[#1a283e] flex items-center gap-1.5">
                                                                            <span className="material-symbols-outlined text-[14px] text-[#cda250]">
                                                                                link
                                                                            </span>
                                                                            <span className="text-xs text-primary truncate hover:underline cursor-pointer">
                                                                                {meeting
                                                                                    .link}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                            </div>

                                                            <div className="border-t border-[#1d2d44]/50 pt-3">
                                                                <span className="text-[9px] text-[#cda250] font-bold uppercase tracking-wider block mb-2">
                                                                    Convocados
                                                                </span>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {summonedDetails
                                                                            .length >
                                                                            0
                                                                        ? (
                                                                            summonedDetails
                                                                                .map(
                                                                                    (
                                                                                        m,
                                                                                    ) => (
                                                                                        <span
                                                                                            key={m
                                                                                                .id}
                                                                                            className="px-2 py-0.5 rounded bg-[#0c1424] text-slate-300 text-[10px] font-semibold border border-[#1a283e]"
                                                                                        >
                                                                                            {m.abrev}
                                                                                            {" "}
                                                                                            {m.war_name}
                                                                                        </span>
                                                                                    )
                                                                                )
                                                                        )
                                                                        : (
                                                                            <span className="text-xs text-slate-600 italic">
                                                                                Nenhum
                                                                                membro
                                                                                listado
                                                                            </span>
                                                                        )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                },
                                            )
                                        )
                                        : (
                                            <div className="col-span-2 py-12 text-center text-slate-500 text-sm">
                                                Nenhuma reunião agendada a
                                                partir de hoje.
                                            </div>
                                        )}
                                </div>
                            )}
                        </div>

                        {/* CSS Injection for custom animation keyframes */}
                        <style>
                            {`
                            @keyframes progress {
                                from { width: 0%; }
                                to { width: 100%; }
                            }
                            .animate-progress {
                                animation-name: progress;
                            }
                        `}
                        </style>
                    </div>
                );
            })()}
        </div>
    );
};

export default TaskForm;
