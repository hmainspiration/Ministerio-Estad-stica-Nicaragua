import { createClient, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import type { User, CensusRecord, NewCensusRecord } from '../types';

// Use Vite's environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Supabase URL and Anon Key must be provided in .env file");
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Custom user mapping to our app's User type
const mapSupabaseUser = (supabaseUser: SupabaseUser | null): User | null => {
    if (!supabaseUser) return null;
    return {
        id: supabaseUser.id,
        email: supabaseUser.email,
        church_name: supabaseUser.user_metadata?.church_name || 'Mi Iglesia'
    };
};

// Helper function to extract a readable error message
const getErrorMessage = (error: any): string => {
    if (typeof error?.message === 'string') {
        return error.message;
    }
    // If the message is not a string, stringify the whole error object for debugging
    try {
        return JSON.stringify(error);
    } catch {
        return 'An unknown error occurred.';
    }
};


export const authService = {
    async signUp(email: string, password: string, churchName: string) {
        const { data, error } = await supabase.auth.signUp({ 
            email, 
            password,
            options: {
                data: {
                    church_name: churchName
                }
            }
        });
        if (error) throw new Error(getErrorMessage(error));
        return { user: data.user, error };
    },

    async signIn(email: string, password: string) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(getErrorMessage(error));
        return { user: data.user, error: null };
    },

    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw new Error(getErrorMessage(error));
    },

    async getUser(): Promise<User | null> {
        const { data: { session } } = await supabase.auth.getSession();
        return mapSupabaseUser(session?.user ?? null);
    },

    onAuthStateChange(callback: (event: string, user: User | null) => void) {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            callback(_event, mapSupabaseUser(session?.user ?? null));
        });
        return {
            unsubscribe: () => subscription.unsubscribe(),
        };
    },

    // Fix: Added the missing 'createProfile' function. This function updates the authenticated
    // user's metadata to include their church name.
    async createProfile(user: User, churchName: string): Promise<User> {
        const { data, error } = await supabase.auth.updateUser({
            data: { church_name: churchName }
        });
        if (error) throw new Error(getErrorMessage(error));
        const updatedUser = mapSupabaseUser(data.user);
        if (!updatedUser) throw new Error("User not found after update.");
        return updatedUser;
    }
};

export const censusService = {
    async getRecords(): Promise<CensusRecord[]> {
        const { data, error } = await supabase
            .from('registros_censo')
            .select('*')
            .order('nombre_completo', { ascending: true });
        if (error) throw new Error(getErrorMessage(error));
        return data || [];
    },

    async createRecord(record: NewCensusRecord): Promise<CensusRecord> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        const recordToInsert = { ...record, user_id: user.id };
        
        const { data, error } = await supabase
            .from('registros_censo')
            .insert(recordToInsert)
            .select()
            .single();

        if (error) throw new Error(getErrorMessage(error));
        return data;
    },
    
    async bulkCreateRecords(records: NewCensusRecord[]): Promise<CensusRecord[]> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');
        
        const recordsToInsert = records.map(r => ({ ...r, user_id: user.id }));
        
        const { data, error } = await supabase
            .from('registros_censo')
            .insert(recordsToInsert)
            .select();

        if (error) throw new Error(getErrorMessage(error));
        return data;
    },

    async updateRecord(record: CensusRecord): Promise<CensusRecord> {
        const { data, error } = await supabase
            .from('registros_censo')
            .update(record)
            .eq('id', record.id)
            .select()
            .single();
        
        if (error) throw new Error(getErrorMessage(error));
        return data;
    },

    async deleteRecord(id: number): Promise<void> {
        const { error } = await supabase
            .from('registros_censo')
            .delete()
            .eq('id', id);

        if (error) throw new Error(getErrorMessage(error));
    }
};
