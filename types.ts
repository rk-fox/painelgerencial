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
  email: string;
  rank: string;
  abrev?: string;
  specialty: 'BCT' | 'AIS';
  entry_date: string;
  last_promotion_date?: string;
  phone?: string;
  status: 'Ativo' | 'Em Viagem' | 'Indisponível';
  avatar: string;
  password_hash?: string;
  requires_password?: boolean;
}

export interface Task {
  id: string;
  code: string;
  title: string;
  description: string;
  type: 'Diária' | 'Semanal' | 'Mensal' | 'Pontual';
  location: string;
  status: 'available' | 'in_progress' | 'completed';
  progress?: number;
}
