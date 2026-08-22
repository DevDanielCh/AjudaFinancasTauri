"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { accountsApi } from "./repository";
import type { AccountInfo, AccountInput } from "./models";

export const accountsKeys = {
  all: ["accounts"] as const,
};

export function useAccountsQuery() {
  return useQuery({
    queryKey: accountsKeys.all,
    queryFn: () => accountsApi.list(),
    staleTime: 30_000,
  });
}

export function useSetActiveAccount() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => accountsApi.setActive(uuid),
    onSuccess: () => {
      // Troca de conta = dados totalmente diferentes; invalidar tudo.
      void client.invalidateQueries();
    },
  });
}

export function useCreateAccount() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: AccountInput) => accountsApi.create(input),
    onSuccess: () => {
      void client.invalidateQueries();
    },
  });
}

export function useUpdateAccount() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, input }: { uuid: string; input: AccountInput }) =>
      accountsApi.update(uuid, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: accountsKeys.all });
    },
  });
}

export function useDeleteAccount() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => accountsApi.remove(uuid),
    onSuccess: () => {
      // Pode trocar a conta ativa; invalidar tudo.
      void client.invalidateQueries();
    },
  });
}

interface AccountsCtx {
  accounts: AccountInfo[];
  active?: AccountInfo;
  isLoading: boolean;
  isSwitching: boolean;
  switchTo: (uuid: string) => void;
  channelsOpen: boolean;
  setChannelsOpen: (open: boolean) => void;
}

const Ctx = createContext<AccountsCtx>({
  accounts: [],
  isLoading: true,
  isSwitching: false,
  switchTo: () => {},
  channelsOpen: false,
  setChannelsOpen: () => {},
});

export function AccountsProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useAccountsQuery();
  const switchMutation = useSetActiveAccount();
  const [isSwitching, setIsSwitching] = useState(false);
  const [channelsOpen, setChannelsOpen] = useState(false);

  const switchTo = useCallback(
    (uuid: string) => {
      if (switchMutation.isPending || isSwitching) return;
      setIsSwitching(true);
      switchMutation.mutate(uuid, {
        onSettled: () => setIsSwitching(false),
      });
    },
    [switchMutation, isSwitching]
  );

  const value = useMemo(
    () => ({
      accounts: data ?? [],
      active: data?.find((a) => a.active),
      isLoading,
      isSwitching: isSwitching || switchMutation.isPending,
      switchTo,
      channelsOpen,
      setChannelsOpen,
    }),
    [data, isLoading, isSwitching, switchMutation.isPending, switchTo, channelsOpen]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useAccounts = () => useContext(Ctx);
