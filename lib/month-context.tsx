"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

interface MonthCtx {
  month: string;
  setMonth: (m: string) => void;
  min: string;
}

const Ctx = createContext<MonthCtx>({ month: "", setMonth: () => {}, min: "" });

export function MonthProvider({ children }: { children: React.ReactNode }) {
  const today = new Date().toISOString().slice(0, 7);
  const [month, setMonthState] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("filterMonth") || today
      : today
  );
  const [min, setMin] = useState(today);

  useEffect(() => {
    api.getEarliestMonth().then(setMin).catch(() => {});
  }, []);

  const setMonth = (m: string) => {
    setMonthState(m);
    localStorage.setItem("filterMonth", m);
  };

  return <Ctx.Provider value={{ month, setMonth, min }}>{children}</Ctx.Provider>;
}

export const useMonth = () => useContext(Ctx);
