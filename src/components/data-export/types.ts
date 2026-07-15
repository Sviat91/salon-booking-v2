export type ModalState =
  | "idle"
  | "loading"
  | "success"
  | "not-found"
  | "error";

export interface ApiError {
  error: string;
  code?: string;
  hints?: string[];
}

export interface UserDataExport {
  personalData: {
    name: string;
    phone: string;
    email?: string;
  };
  consentHistory: {
    consentDate: string;
    ipHash: string;
    privacyV10: boolean;
    termsV10: boolean;
    notificationsV10: boolean;
    withdrawnDate?: string;
    withdrawalMethod?: string;
  }[];
  isAnonymized: boolean;
  exportTimestamp: string;
}
