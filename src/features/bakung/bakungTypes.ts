import { UserProfile } from "../../types";

export interface BakungTrip {
  id?: string;
  date: string;
  time: string;
  datetime: Date | any;
  vehicle_id?: string;
  vehicle_source_type: string;
  vehicle_source_label: string;
  vehicle_type: string;
  vehicle_type_label: string;
  plate_number: string;
  source_origin_type: string;
  source_origin_label: string;
  upt_id?: string;
  upt_name?: string;
  external_origin_name?: string;
  gross_weight_kg: number;
  default_empty_weight_kg: number;
  net_operational_weight_kg: number;
  weighing_method: string;
  notes?: string;
  status?: 'valid' | 'cancel_requested' | 'cancelled';
  created_by_uid: string;
  created_by_name: string;
  created_by_role: string;
  created_at: any;
  updated_at: any;
}

export interface BakungDashboardViewProps {
  profile: UserProfile | null;
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  upts?: any[];
  vehicles?: any[];
  logActivity?: (
    category: 'login' | 'operasional' | 'perubahan_data' | 'sistem',
    action: string,
    module: string,
    description: string,
    extra?: {
      recordId?: string;
      recordLabel?: string;
      beforeData?: any;
      afterData?: any;
      metadata?: any;
      profile?: UserProfile | null;
    }
  ) => Promise<void>;
}
