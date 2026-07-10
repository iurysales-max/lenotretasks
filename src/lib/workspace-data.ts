import { supabase } from "@/integrations/supabase/client";

export interface Sector { id: string; name: string; color: string; icon: string; description: string | null; responsible_id: string | null; }
export interface Category { id: string; name: string; color: string; icon: string; description: string | null; }
export interface TaskStatus { id: string; name: string; color: string; position: number; is_done: boolean; }
export interface ProfileLite { id: string; name: string; email: string; avatar_url: string | null; cargo: string | null; sector_id: string | null; }
export type Priority = "baixa" | "normal" | "alta" | "urgente";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  sector_id: string | null;
  category_id: string | null;
  status_id: string | null;
  priority: Priority;
  created_by: string;
  due_date: string | null;
  due_time: string | null;
  estimated_minutes: number | null;
  spent_minutes: number;
  pinned: boolean;
  archived: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export const fetchSectors = async () =>
  (await supabase.from("sectors").select("*").order("name")).data as Sector[] ?? [];

export const fetchCategories = async () =>
  (await supabase.from("categories").select("*").order("name")).data as Category[] ?? [];

export const fetchStatuses = async () =>
  (await supabase.from("task_statuses").select("*").order("position")).data as TaskStatus[] ?? [];

export const fetchProfiles = async () =>
  (await supabase.from("profiles").select("id,name,email,avatar_url,cargo,sector_id").order("name")).data as ProfileLite[] ?? [];

export const PRIORITY_META: Record<Priority, { label: string; color: string; ring: string }> = {
  baixa: { label: "Baixa", color: "#94a3b8", ring: "ring-slate-400" },
  normal: { label: "Normal", color: "#3b82f6", ring: "ring-blue-500" },
  alta: { label: "Alta", color: "#f59e0b", ring: "ring-amber-500" },
  urgente: { label: "Urgente", color: "#ef4444", ring: "ring-red-500" },
};

export const minutesToLabel = (m: number | null) => {
  if (!m) return "—";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h${min ? ` ${min}m` : ""}` : `${min}m`;
};
