import type { Timestamp } from "firebase/firestore";
export type TransactionType = "income" | "expense" | "investment";
export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  description: string;
  amount: number;
  date: string;
  referenceMonth: number;
  referenceYear: number;
  pierreId?: string;
  category?: string;
  accountId?: string;
  recurrenceId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}
export type TransactionInput = Omit<
  Transaction,
  "id" | "userId" | "createdAt" | "updatedAt"
>;
export type AccentColor = "blue" | "green" | "purple" | "orange";

export type PlanType = "income" | "expense";
export type RecurrencePeriod = "monthly" | "quarterly" | "yearly";

export interface PlannedTransaction {
  id: string;
  userId: string;
  type: PlanType;
  description: string;
  amount: number;
  date: string;
  category: string;
  paid?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type PlannedTransactionInput = Omit<
  PlannedTransaction,
  "id" | "userId" | "createdAt" | "updatedAt"
>;

export interface Recurrence {
  id: string;
  userId: string;
  type: PlanType;
  description: string;
  amount: number;
  startDate: string;
  originalDay: number;
  category: string;
  period: RecurrencePeriod;
  limit?: number;
  paid?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type RecurrenceInput = Omit<
  Recurrence,
  "id" | "userId" | "createdAt" | "updatedAt"
>;

export interface ShoppingItem {
  id: string;
  userId: string;
  name: string;
  qty: number;
  price: number;
  done: boolean;
  createdDate: string;
  completedDate?: string | null;
  order: number;
}

export type ShoppingItemInput = Omit<ShoppingItem, "id" | "userId">;

export interface ShoppingHistoryItem {
  name: string;
  qty: number;
  price?: number;
}

export interface ShoppingHistory {
  id: string;
  userId: string;
  title?: string;
  date: string;
  total: number;
  items: ShoppingHistoryItem[];
}

export type ShoppingHistoryInput = Omit<ShoppingHistory, "id" | "userId">;
