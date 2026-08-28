export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

export interface Member {
  id: string;
  name: string;
  war_name?: string;
  email?: string;
  rank?: string;
  abrev?: string;
  specialty?: 'BCT' | 'AIS' | 'CTA' | string;
  entry_date?: string;
  last_promotion_date?: string;
  guia_antiguidade?: number;
  phone?: string;
  status?: 'Ativo' | 'Em Viagem' | 'Indisponível' | string;
  avatar?: string;
  courses?: string[];
  sector?: string;
  user_id?: string;
  encarregado?: boolean;
}

export interface Task {
  id: string;
  code?: string;
  title: string;
  description?: string;
  type?: 'Diária' | 'Semanal' | 'Mensal' | 'Pontual' | string;
  location?: string;
  status?: 'available' | 'in_progress' | 'completed' | string;
  progress?: number;
  mission_id?: string;
  qb?: boolean;
  despacho?: string | null;
  obs?: string | null;
  prazo_final?: string | null;
  sector?: string;
  created_at?: string;
  completed_at?: string | null;
  assigned_to?: string[] | null;
  cat_id?: string | null;
}

export interface TaskCategory {
  id: string;
  name: string;
  sector?: string;
  created_at?: string;
}

export interface Mission {
  id: string;
  nome: string;
  local?: string;
  deslocamento?: string;
  qtd_equipe?: number;
  fav?: boolean;
  gratrep?: boolean;
  gt?: boolean;
  valid?: boolean;
  data_inicio: string;
  data_fim: string;
  equipe?: string[];
  task_id?: string | null;
  sector?: string;
  created_at?: string;
}

export interface Sdia {
  id: string;
  member_id: string;
  sdia_num?: string;
  data_inicio: string;
  data_fim: string;
  obs?: string;
  tipo?: string;
  checked?: boolean;
  sector?: string;
  created_at?: string;
}

export interface Unavailability {
  id: string;
  member_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
  sector?: string;
  created_at?: string;
}

export interface Meeting {
  id: string;
  assunto: string;
  detalhes?: string | null;
  inicio: string;
  fim: string;
  link?: string | null;
  membros?: string[];
  created_at?: string;
}

export interface ShortcutLink {
  id: string;
  titulo: string;
  link: string;
  descricao?: string;
  icon?: string;
  sector: string;
  created_at?: string;
}

export interface CHDelegation {
  id: string;
  grantor_id: string;
  beneficiary_id: string;
  start_date: string;
  end_date?: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface Annotation {
  id: string;
  member_id: string;
  date: string;
  note: string;
  created_at?: string;
}
