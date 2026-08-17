"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getEarliestMonth } from "@/src/shared/repository";
import { earliestMonthKeys } from "@/src/shared/services";

interface MonthCtx {
  month: string;
  setMonth: (m: string) => void;
  min: string;
}

const Ctx = createContext<MonthCtx>({ month: "", setMonth: () => {}, min: "" });

export function MonthProvider({ children }: { children: React.ReactNode }) {
  const today = new Date().toISOString().slice(0, 7);
  const [month, setMonthState] = useState(today);

  const earliest = useQuery({
    queryKey: earliestMonthKeys,
    queryFn: () => getEarliestMonth(),
    staleTime: 60_000,
  });

  useEffect(() => {
    const saved = localStorage.getItem("filterMonth");
    if (saved) setMonthState(saved); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const setMonth = (m: string) => {
    setMonthState(m);
    localStorage.setItem("filterMonth", m);
  };

  return (
    <Ctx.Provider value={{ month, setMonth, min: earliest.data ?? today }}>
      {children}
    </Ctx.Provider>
  );
}

export const useMonth = () => useContext(Ctx);
