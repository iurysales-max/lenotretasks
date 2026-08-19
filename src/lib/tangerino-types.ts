export interface PunchPair {
  in: string | null;
  out: string | null;
  localIn?: string | null;
  localOut?: string | null;
}

export interface EmployeeDay {
  employeeId: number;
  name: string;
  email: string | null;
  pin: string | null;
  externalId: string | null;
  entrada: string | null;
  saida: string | null;
  intervalos: { start: string; end: string; minutes: number }[];
  pairs: PunchPair[];
  workedMinutes: number;
  breakMinutes: number;
  pendente: boolean;
  origem: string | null;
  localEntrada?: string | null;
  localSaida?: string | null;
  fonte: "api" | "planilha";
}

export interface PunchDayResult {
  date: string;
  total: number;
  employees: EmployeeDay[];
}

export interface OvertimeDay {
  date: string;
  workedMinutes: number;
  breakMinutes: number;
  entrada: string | null;
  saida: string | null;
  pendente: boolean;
}

export interface OvertimeEmployee {
  name: string;
  daysWorked: number;
  workedMinutes: number;
  expectedMinutes: number;
  overtimeMinutes: number;
  deficitMinutes: number;
  days: OvertimeDay[];
}

export interface OvertimeRangeResult {
  start: string;
  end: string;
  dailyExpectedMinutes: number;
  employees: OvertimeEmployee[];
}

