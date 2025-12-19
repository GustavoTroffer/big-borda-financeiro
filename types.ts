
export enum StaffRole {
  MOTOBOY = 'Motoboy',
  KITCHEN = 'Cozinha',
  ATENDENTE = 'Atendente'
}

export interface StaffMember {
  id: string;
  name: string;
  pixKey: string;
  phone: string;
  role: StaffRole;
}

export interface DailySales {
  ifood: number;
  kcms: number; // Antigo App2
  sgv: number; // Antigo App3
}

export interface StaffPayment {
  staffId: string;
  amount: number;
  deliveryCount?: number; // Quantidade de entregas (para motoboys)
}

export interface DebtItem {
  id: string;
  name: string;
  amount: number;
}

export interface PendingItem {
  id: string;
  name: string;
  amount: number;
  date?: string; // Data referente à pendência
}

export interface AuditEntry {
  timestamp: string;
  staffName: string;
  action: string;
}

export interface DailyCloseRecord {
  id: string;
  date: string; // ISO string YYYY-MM-DD
  sales: DailySales;
  payments: StaffPayment[];
  debts: DebtItem[]; // Fiados (Devem para o restaurante)
  pendingPayables?: PendingItem[]; // Pendências (Restaurante deve para alguém)
  ifoodMotoboys?: {
    count: number;
    totalCost: number;
    rides: number[]; // Lista de valores das corridas
  };
  notes: string;
  closedByStaffId?: string; // ID do atendente que fez o fechamento
  isClosed: boolean;
  auditLog?: AuditEntry[]; // Histórico de alterações
  createdAt?: string;
  updatedAt?: string;
}

export type ViewState = 'dashboard' | 'staff' | 'closing' | 'reports';

// Weekly Schedule Types
export type DayOfWeek = 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta' | 'sabado' | 'domingo';

export interface WeeklySchedule {
  [key: string]: string[]; // key is DayOfWeek, value is array of staff IDs
}