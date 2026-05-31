import { UserProfile, UserRole } from "../../types";

export interface UsersViewProps {
  users: UserProfile[];
  profile: UserProfile | null;
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  upts: any[];
  onResetPasswordSuccess: (data: { tempPassword: string; username: string }) => void;
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
