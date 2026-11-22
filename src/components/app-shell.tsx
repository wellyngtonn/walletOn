"use client";
import { createContext, useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { AuthGuard } from "./auth-guard";
import { Sidebar } from "./sidebar";
import { MonthPicker } from "./month-picker";
import { TransactionModal } from "./transaction-modal";
import { useAuth } from "@/hooks/useAuth";
import { useBankProfile } from "@/hooks/useBankProfile";
import { useBankAutoSync } from "@/hooks/useBankAutoSync";
import { useTransactions } from "@/hooks/useTransactions";
import type { Transaction, TransactionType } from "@/types";
import type { BankProvider } from "@/utils/bank";

type Ctx = {
  month: number;
  year: number;
  setPeriod: (m: number, y: number) => void;
  transactions: Transaction[];
  loading: boolean;
  error: string;
  accountBalance: number | null;
  accountId: string | null;
  accountName: string | null;
  bankProvider: BankProvider | null;
  openEdit: (t: Transaction) => void;
  openCreate: (type?: TransactionType) => void;
};

const DashboardContext = createContext<Ctx | null>(null);
export const useDashboard = () => {
  const x = useContext(DashboardContext);
  if (!x) throw new Error("DashboardContext");
  return x;
};

function Inner({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [createType, setCreateType] = useState<TransactionType>("expense");
  const data = useTransactions(user?.uid, month, year);
  const {
    balance: accountBalance,
    accountId,
    accountName,
    provider: bankProvider,
    connected: bankConnected,
    loading: bankProfileLoading,
    error: balanceError,
  } = useBankProfile(user?.uid);

  useBankAutoSync({
    uid: user?.uid,
    connected: bankConnected,
    provider: bankProvider,
    preferredAccountId: accountId,
    profileLoading: bankProfileLoading,
  });

  function openEdit(t: Transaction) {
    setEditing(t);
    setModal(true);
  }
  function openCreate(type: TransactionType = "expense") {
    setEditing(null);
    setCreateType(type);
    setModal(true);
  }

  const pickerPages = ["/analise", "/planejamento"].some(
    (page) => pathname === page || pathname === `${page}/`,
  );

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
        accountBalance,
        accountId,
        accountName,
        bankProvider,
        openEdit,
        openCreate,
      }}
    >
      <Sidebar />
      <main
        className="app-shell-main min-h-screen px-4 pb-32 pt-20 md:px-7 md:pt-7"
      >
        {pickerPages ? (
          <header className="mb-5 flex items-center justify-end md:pr-[64px]">
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
        ) : null}
        <div className="mx-auto max-w-[1160px]">{children}</div>
        <TransactionModal
          open={modal}
          transaction={editing}
          initialType={createType}
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
