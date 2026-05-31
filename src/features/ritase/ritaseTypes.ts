import { UserProfile, TripRecord } from "../../types";

export interface InputRitaseViewProps {
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  upts: any[];
  tpas: any[];
  settings: any;
  profile: UserProfile | null;
  drivers: any[];
  vehicles: any[];
  setActiveTab: (tab: string) => void;
  trips: any[];
  logActivity: (
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
  ) => void;
}

export interface TripsViewProps {
  trips: TripRecord[];
  profile: UserProfile | null;
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  upts: any[];
  tpas: any[];
  settings: any;
  drivers: any[];
  vehicles: any[];
  setActiveTab: (tab: string) => void;
  users?: any[];
  tripFilterRange: { start: string; end: string };
  setTripFilterRange: (range: { start: string; end: string }) => void;
  logActivity: (
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
  ) => void;
}

export interface ReportsViewProps {
  trips: TripRecord[];
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  settings: any;
  upts?: any[];
  users?: any[];
  profile: UserProfile | null;
  tripFilterRange: { start: string; end: string };
  setTripFilterRange: (range: { start: string; end: string }) => void;
  reportsCache: any;
  setReportsCache: (cache: any) => void;
  logActivity: (
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
  ) => void;
}
