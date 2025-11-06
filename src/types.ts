// Mock Supabase User type
export interface User {
  id: string;
  email?: string;
  church_name: string;
}

// Corresponds to public.registros_censo table
export interface CensusRecord {
  id: number; // BIGINT, primary key
  user_id: string; // UUID, references auth.users(id)
  created_at?: string; // TIMESTAMPTZ
  nombre_completo: string;
  fecha_nacimiento?: string; // DATE
  numero_cedula?: string;
  genero?: 'Masculino' | 'Femenino';
  grupo?: 'C' | 'CC' | 'CG' | 'CM' | 'J' | 'S' | 'N';
  estado: 'Activo' | 'Retirado Temporal' | 'Archivado' | 'Trasladado';
}

export type NewCensusRecord = Omit<CensusRecord, 'id' | 'user_id' | 'created_at'>;

export interface SyncOperation {
  id?: number; // Auto-incrementing primary key for IndexedDB
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  payload: CensusRecord | { id: number };
  timestamp: number;
}

export interface ColumnMap {
  [key: string]: string; // Maps application field (e.g., 'nombre_completo') to Excel column header (e.g., 'NOMBRE')
}
