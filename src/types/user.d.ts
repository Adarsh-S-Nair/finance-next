/** Shape of the user profile row from Supabase */
export interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  accent_color: string | null;
  subscription_tier: string;
  theme: string | null;
  [key: string]: unknown;
}

/** Shape returned by useUser() from UserProvider */
export interface UserContextValue {
  user: import("@supabase/supabase-js").User | null;
  profile: UserProfile | null;
  loading: boolean;
  isPro: boolean;
  refreshProfile: () => Promise<void>;
  setTheme: (theme: string) => void;
  setAccentColor: (hexOrNull: string | null) => void;
  logout: () => void;
}
