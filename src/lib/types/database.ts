// Phase 1 schema mirror. Hand-written for now; regenerate later with:
//   npx supabase gen types typescript --project-id <ref> --schema public > src/lib/types/database.ts
// Keep in sync with supabase/migrations/*.sql.

export type UserRole = "admin" | "procurement" | "viewer";
export type ContactChannel = "wechat" | "phone" | "email" | "other";
export type SupplierPlatform = "1688" | "alibaba" | "direct_factory" | "other";
export type Brand = "rumah_raya" | "surprice_store" | "other";
export type AssumptionBasis =
  | "Historical Restock Data"
  | "Competitor Benchmark"
  | "Affiliate Campaign Projection"
  | "Wild Assumption";
export type ConfidenceLevel = "High" | "Medium" | "Low";
export type DecisionStatus = "Needs Review" | "Approve" | "Hold" | "Reject";
export type CompetitorPlatform = "TikTok Shop" | "Shopee" | "Other";
export type SpecMatch = "Same" | "Similar" | "Different";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: UserRole;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
        };
      };
      suppliers: {
        Row: {
          id: string;
          name: string;
          contact_channel: ContactChannel | null;
          contact_handle: string | null;
          platform: SupplierPlatform | null;
          payment_terms: string | null;
          typical_lead_time_days: number | null;
          reliability_notes: string | null;
          business_card_url: string | null;
          address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          contact_channel?: ContactChannel | null;
          contact_handle?: string | null;
          platform?: SupplierPlatform | null;
          payment_terms?: string | null;
          typical_lead_time_days?: number | null;
          reliability_notes?: string | null;
          business_card_url?: string | null;
          address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["suppliers"]["Insert"]>;
      };
      products: {
        Row: {
          id: string;
          sku: string;
          name: string;
          brand: Brand | null;
          category: string | null;
          spec_summary: string | null;
          photo_url: string | null;
          current_stock_on_hand: number;
          incoming_po_qty: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sku: string;
          name: string;
          brand?: Brand | null;
          category?: string | null;
          spec_summary?: string | null;
          photo_url?: string | null;
          current_stock_on_hand?: number;
          incoming_po_qty?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
      };
      supplier_quotes: {
        Row: {
          id: string;
          supplier_id: string;
          product_id: string | null;
          rmb_price: number;
          moq: number | null;
          quote_date: string;
          valid_until: string | null;
          notes: string | null;
          source_file: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id: string;
          product_id?: string | null;
          rmb_price: number;
          moq?: number | null;
          quote_date: string;
          valid_until?: string | null;
          notes?: string | null;
          source_file?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["supplier_quotes"]["Insert"]>;
      };
      settings: {
        Row: {
          id: number;
          fx_rate_rmb_idr: number;
          default_safety_stock_days: number;
          default_import_duty_pct: number;
          container_cbm_cap: number | null;
          default_admin_pct: number;
          default_target_margin_pct: number;
          updated_at: string;
        };
        Insert: {
          id?: number;
          fx_rate_rmb_idr?: number;
          default_safety_stock_days?: number;
          default_import_duty_pct?: number;
          container_cbm_cap?: number | null;
          default_admin_pct?: number;
          default_target_margin_pct?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["settings"]["Insert"]>;
      };
      competitors: {
        Row: {
          id: string;
          name: string;
          specialization: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          specialization?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["competitors"]["Insert"]>;
      };
      competitor_products: {
        Row: {
          id: string;
          competitor_id: string;
          name: string;
          price_idr: number | null;
          photo_url: string | null;
          spec_summary: string | null;
          product_url: string | null;
          source_file: string | null;
          fields: Record<string, string>;
          product_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          competitor_id: string;
          name: string;
          price_idr?: number | null;
          photo_url?: string | null;
          spec_summary?: string | null;
          product_url?: string | null;
          source_file?: string | null;
          fields?: Record<string, string>;
          product_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["competitor_products"]["Insert"]>;
      };
      restock_decisions: {
        Row: {
          id: string;
          product_id: string;
          sales_velocity_1mo: number | null;
          sales_velocity_3mo_avg: number | null;
          lead_time_days: number | null;
          safety_stock_days_override: number | null;
          fx_rate_override: number | null;
          ongkir_per_unit: number | null;
          import_duty_pct_override: number | null;
          target_harga_jual: number | null;
          proposed_qty: number | null;
          assumption_basis: AssumptionBasis | null;
          confidence_level: ConfidenceLevel | null;
          assumed_monthly_sales_post_restock: number | null;
          notes: string | null;
          decision_status: DecisionStatus;
          approved_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          sales_velocity_1mo?: number | null;
          sales_velocity_3mo_avg?: number | null;
          lead_time_days?: number | null;
          safety_stock_days_override?: number | null;
          fx_rate_override?: number | null;
          ongkir_per_unit?: number | null;
          import_duty_pct_override?: number | null;
          target_harga_jual?: number | null;
          proposed_qty?: number | null;
          assumption_basis?: AssumptionBasis | null;
          confidence_level?: ConfidenceLevel | null;
          assumed_monthly_sales_post_restock?: number | null;
          notes?: string | null;
          decision_status?: DecisionStatus;
          approved_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["restock_decisions"]["Insert"]>;
      };
      competitor_prices: {
        Row: {
          id: string;
          product_id: string;
          competitor_seller: string | null;
          platform: CompetitorPlatform | null;
          photo_url: string | null;
          spec_summary: string | null;
          spec_match: SpecMatch | null;
          price: number;
          product_url: string | null;
          date_checked: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          competitor_seller?: string | null;
          platform?: CompetitorPlatform | null;
          photo_url?: string | null;
          spec_summary?: string | null;
          spec_match?: SpecMatch | null;
          price: number;
          product_url?: string | null;
          date_checked?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["competitor_prices"]["Insert"]>;
      };
      price_list_files: {
        Row: {
          id: string;
          file_name: string;
          storage_path: string;
          size_bytes: number | null;
          supplier_id: string | null;
          uploaded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          file_name: string;
          storage_path: string;
          size_bytes?: number | null;
          supplier_id?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["price_list_files"]["Insert"]>;
      };
      field_quotes: {
        Row: {
          id: string;
          supplier_id: string | null;
          product_id: string | null;
          product_name: string | null;
          photo_url: string | null;
          price_rmb: number | null;
          qty_per_carton: number | null;
          carton_p_cm: number | null;
          carton_l_cm: number | null;
          carton_t_cm: number | null;
          cbm: number | null;
          size_p_cm: number | null;
          size_l_cm: number | null;
          size_t_cm: number | null;
          fx_rate: number;
          freight_per_cbm: number;
          admin_pct: number;
          order_fee: number;
          packaging_fee: number;
          est_sell_price: number | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          supplier_id?: string | null;
          product_id?: string | null;
          product_name?: string | null;
          photo_url?: string | null;
          price_rmb?: number | null;
          qty_per_carton?: number | null;
          carton_p_cm?: number | null;
          carton_l_cm?: number | null;
          carton_t_cm?: number | null;
          cbm?: number | null;
          size_p_cm?: number | null;
          size_l_cm?: number | null;
          size_t_cm?: number | null;
          fx_rate?: number;
          freight_per_cbm?: number;
          admin_pct?: number;
          order_fee?: number;
          packaging_fee?: number;
          est_sell_price?: number | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["field_quotes"]["Insert"]>;
      };
      trips: {
        Row: {
          id: string;
          name: string;
          storage_path: string;
          size_bytes: number | null;
          selected_sheets: { index: number; name: string; kind: "supplier" | "other" }[];
          source_url: string | null;
          uploaded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          storage_path: string;
          size_bytes?: number | null;
          selected_sheets?: { index: number; name: string; kind: "supplier" | "other" }[];
          source_url?: string | null;
          uploaded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["trips"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      contact_channel: ContactChannel;
      supplier_platform: SupplierPlatform;
      brand: Brand;
      assumption_basis: AssumptionBasis;
      confidence_level: ConfidenceLevel;
      decision_status: DecisionStatus;
      competitor_platform: CompetitorPlatform;
      spec_match: SpecMatch;
    };
  };
}
