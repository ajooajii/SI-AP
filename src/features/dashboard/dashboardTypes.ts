import React from "react";
import { UserProfile, TripRecord } from "../../types";

export interface DashboardViewProps {
  trips: TripRecord[];
  profile: UserProfile | null;
  onAddClick: () => void;
  upts: any[];
  tpas: any[];
  settings: any;
  tripFilterRange: { start: string; end: string };
  setTripFilterRange: (range: { start: string; end: string }) => void;
}

export interface StatsCardProps {
  label: string;
  value: string;
  subValue?: string;
  icon: React.ReactNode;
  onClick?: () => void;
}
