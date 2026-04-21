// CMY Supabase database types.
// Hand-authored from supabase/migrations/001_initial_schema.sql. After the
// migrations are applied, regenerate via:
//   supabase gen types typescript --project-id <ref> --schema public \
//     > apps/web/lib/database.types.ts

export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export type Gender = "male" | "female";
export type RequestStatus = "pending" | "accepted" | "declined";

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string;
                    wallet_address: string;
                    display_name: string;
                    age: number;
                    gender: Gender;
                    seeking: Gender;
                    bio: string | null;
                    photos: string[];
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    wallet_address: string;
                    display_name: string;
                    age: number;
                    gender: Gender;
                    seeking: Gender;
                    bio?: string | null;
                    photos?: string[];
                    is_active?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
            };
            matches: {
                Row: {
                    id: string;
                    user_a: string;
                    user_b: string;
                    matched_at: string;
                    is_active: boolean;
                    tx_hash: string | null;
                };
                Insert: {
                    id?: string;
                    user_a: string;
                    user_b: string;
                    matched_at?: string;
                    is_active?: boolean;
                    tx_hash?: string | null;
                };
                Update: Partial<Database["public"]["Tables"]["matches"]["Insert"]>;
            };
            connection_requests: {
                Row: {
                    id: string;
                    sender: string;
                    recipient: string;
                    status: RequestStatus;
                    fee_tx_hash: string;
                    created_at: string;
                    responded_at: string | null;
                };
                Insert: {
                    id?: string;
                    sender: string;
                    recipient: string;
                    status?: RequestStatus;
                    fee_tx_hash: string;
                    created_at?: string;
                    responded_at?: string | null;
                };
                Update: Partial<Database["public"]["Tables"]["connection_requests"]["Insert"]>;
            };
            chat_sessions: {
                Row: {
                    id: string;
                    match_id: string;
                    session_date: string;
                    message_count: number;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    match_id: string;
                    session_date: string;
                    message_count?: number;
                    created_at?: string;
                };
                Update: Partial<Database["public"]["Tables"]["chat_sessions"]["Insert"]>;
            };
            milestones: {
                Row: {
                    id: string;
                    match_id: string;
                    milestone_id: string;
                    triggered_at: string;
                    fulfilled_by: string | null;
                    fulfilled_at: string | null;
                    gift_tx_hash: string | null;
                };
                Insert: {
                    id?: string;
                    match_id: string;
                    milestone_id: string;
                    triggered_at?: string;
                    fulfilled_by?: string | null;
                    fulfilled_at?: string | null;
                    gift_tx_hash?: string | null;
                };
                Update: Partial<Database["public"]["Tables"]["milestones"]["Insert"]>;
            };
            reports: {
                Row: {
                    id: string;
                    reporter: string;
                    reported: string;
                    reason: string;
                    created_at: string;
                    resolved: boolean;
                };
                Insert: {
                    id?: string;
                    reporter: string;
                    reported: string;
                    reason: string;
                    created_at?: string;
                    resolved?: boolean;
                };
                Update: Partial<Database["public"]["Tables"]["reports"]["Insert"]>;
            };
        };
        Views: Record<string, never>;
        Functions: Record<string, never>;
        Enums: Record<string, never>;
    };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Match = Database["public"]["Tables"]["matches"]["Row"];
export type ConnectionRequest = Database["public"]["Tables"]["connection_requests"]["Row"];
export type ChatSession = Database["public"]["Tables"]["chat_sessions"]["Row"];
export type Milestone = Database["public"]["Tables"]["milestones"]["Row"];
export type Report = Database["public"]["Tables"]["reports"]["Row"];
