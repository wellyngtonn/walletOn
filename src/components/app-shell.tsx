"use client";
import { createContext, useContext, useState } from "react";
import { AuthGuard } from "./auth-guard";
import { Sidebar } from "./sidebar";
import { MonthPicker } from "./month-picker";
import { TransactionModal } from "./transaction-modal";
import { useAuth } from "@/hooks/useAuth";
import { usePierreBalance } from "@/hooks/usePierreBalance";
import { useTransactions } from "@/hooks/useTransactions";
import type { Transaction } from "@/types";

type Ctx = {
  month: number;
  year: number;
  setPeriod: (m: number, y: number) => void;
  transactions: Transaction[];
  loading: boolean;
  error: string;
  pierreBalance: number | null;
  pierreAccountId: string | null;
  pierreAccountName: string | null;
  openEdit: (t: Transaction) => void;
  openCreate: () => void;
};

const DashboardContext = createContext<Ctx | null>(null);
export const useDashboard = () => {
  const x = useContext(DashboardContext);
  if (!x) throw new Error("DashboardContext");
  return x;
};

function Inner({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const data = useTransactions(user?.uid, month, year);
  const {
    balance: pierreBalance,
    accountId: pierreAccountId,
    accountName: pierreAccountName,
    error: balanceError,
  } = usePierreBalance(user?.uid);

  function openEdit(t: Transaction) {
    setEditing(t);
    setModal(true);
  }
  function openCreate() {
    setEditing(null);
    setModal(true);
  }

  return (
    <DashboardContext.Provider
      value={{
        month,
        year,
        setPeriod: (m, y) => {
          setMonth(m);
          setYear(y);
        },
        ...data,
        error: data.error || balanceError,
        pierreBalance,
        pierreAccountId,
        pierreAccountName,
        openEdit,
        openCreate,
      }}
    >
      <Sidebar />
      <main
        className="min-h-screen px-4 pb-32 pt-20 md:px-7 md:pt-7"
      >
        <header className="mb-5 flex items-center justify-end">
          <div className="flex items-center gap-2">
            <MonthPicker
              month={month}
              year={year}
              onChange={(m, y) => {
                setMonth(m);
                setYear(y);
              }}
            />
          </div>
        </header>
        <div className="mx-auto max-w-[1160px]">{children}</div>
        <TransactionModal
          open={modal}
          transaction={editing}
          month={month}
          year={year}
          onClose={() => setModal(false)}
        />
      </main>
    </DashboardContext.Provider>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <Inner>{children}</Inner>
    </AuthGuard>
  );
}
