import React, { createContext, useContext, useState } from "react";

interface AppDateContextValue {
  appDate: Date;
  setAppDate: (d: Date) => void;
}

const AppDateContext = createContext<AppDateContextValue | null>(null);

export function AppDateProvider({ children }: { children: React.ReactNode }) {
  const [appDate, setAppDate] = useState<Date>(() => new Date());
  return (
    <AppDateContext.Provider value={{ appDate, setAppDate }}>
      {children}
    </AppDateContext.Provider>
  );
}

export function useAppDate(): AppDateContextValue {
  const ctx = useContext(AppDateContext);
  if (!ctx) throw new Error("useAppDate must be used within AppDateProvider");
  return ctx;
}
