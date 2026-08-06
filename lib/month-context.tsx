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
  const [month, setMonthState] = useState(today);
  const [min, setMin] = useState(today);

  useEffect(() => {
    const saved = localStorage.getItem("filterMonth");
    if (saved) setMonthState(saved); // eslint-disable-line react-hooks/set-state-in-effect
    api.getEarliestMonth().then(setMin).catch(() => {});
  }, []);

  const setMonth = (m: string) => {
    setMonthState(m);
    localStorage.setItem("filterMonth", m);
  };

  return <Ctx.Provider value={{ month, setMonth, min }}>{children}</Ctx.Provider>;
}

export const useMonth = () => useContext(Ctx);
