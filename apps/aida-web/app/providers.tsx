import { AuthProvider } from "./lib/auth-context";

export const AppProviders = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;
