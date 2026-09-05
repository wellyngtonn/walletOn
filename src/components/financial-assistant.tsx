"use client";

import { FormEvent, type ReactNode, useState } from "react";
import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import { auth } from "@/lib/firebase/config";
import {
  askFinancialAssistant,
  type AssistantMessage,
} from "@/services/financial-assistant";
import {
  listPlans,
  listRecurrences,
  listTransactions,
} from "@/services/transactions";

const initialMessage: AssistantMessage = {
  role: "model",
  text: "Olá! Posso consultar suas transações e resumir seus gastos. O que você quer saber?",
};

function renderInlineMarkdown(value: string): ReactNode[] {
  return value.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function renderAssistantText(value: string) {
  return value.split(/\r?\n/).map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return <span className="financial-assistant-line-break" key={`break-${index}`} />;

    const heading = trimmed.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      return (
        <div className="financial-assistant-section-title" key={`heading-${index}`}>
          {renderInlineMarkdown(heading[1])}
        </div>
      );
    }

    const numberedItem = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (numberedItem) {
      return (
        <div className="financial-assistant-list-item" key={`number-${index}`}>
          <span className="financial-assistant-list-marker">{numberedItem[1]}</span>
          <span>{renderInlineMarkdown(numberedItem[2])}</span>
        </div>
      );
    }

    const bulletItem = trimmed.match(/^[-*]\s+(.+)$/);
    if (bulletItem) {
      return (
        <div className="financial-assistant-list-item" key={`bullet-${index}`}>
          <span className="financial-assistant-list-marker">•</span>
          <span>{renderInlineMarkdown(bulletItem[1])}</span>
        </div>
      );
    }

    return (
      <p className="financial-assistant-paragraph" key={`paragraph-${index}`}>
        {renderInlineMarkdown(trimmed)}
      </p>
    );
  });
}

function requestsPlanningData(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return /\b(plano|planos|planejamento|planejad[oa]s?|recorrenc(?:ia|ias)|recorrente?s?|contas futuras|compromissos? futuros?)\b/.test(normalized);
}

export function FinancialAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([initialMessage]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message || busy) return;

    const history = messages.slice(-8);
    const userMessage: AssistantMessage = { role: "user", text: message };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setError("");
    setBusy(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Faça login para usar o assistente financeiro.");
      const includePlanning = requestsPlanningData(message);
      const [transactions, plans, recurrences] = await Promise.all([
        listTransactions(currentUser.uid),
        includePlanning ? listPlans(currentUser.uid) : Promise.resolve([]),
        includePlanning ? listRecurrences(currentUser.uid) : Promise.resolve([]),
      ]);
      const response = await askFinancialAssistant(
        message,
        history,
        transactions,
        plans,
        recurrences,
      );
      setMessages((current) => [
        ...current,
        { role: "model", text: response.text },
      ]);
    } catch (exception) {
      setError(
        exception instanceof Error
          ? exception.message
          : "Não foi possível consultar o assistente.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open && (
        <aside className="financial-assistant" aria-label="Assistente financeiro">
          <div className="financial-assistant-header">
            <div>
              <h2 className="financial-assistant-title">
                <Sparkles size={16} aria-hidden="true" /> Assistente financeiro
              </h2>
              <p className="financial-assistant-subtitle">Consultas somente leitura</p>
            </div>
            <button
              type="button"
              className="financial-assistant-close"
              onClick={() => setOpen(false)}
              aria-label="Fechar assistente"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="financial-assistant-messages" aria-live="polite">
            {messages.map((message, index) => (
              <div
                className={`financial-assistant-message financial-assistant-message--${message.role}`}
                key={`${message.role}-${index}`}
              >
                <div className="financial-assistant-message-content">
                  {renderAssistantText(message.text)}
                </div>
              </div>
            ))}
            {busy && <div className="financial-assistant-message financial-assistant-message--model">Analisando suas transações...</div>}
          </div>

          {error && <p className="msg-error financial-assistant-error">{error}</p>}

          <form className="financial-assistant-form" onSubmit={submit}>
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ex.: quanto gastei este mês?"
              maxLength={2000}
              aria-label="Pergunta para o assistente financeiro"
              disabled={busy}
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Enviar pergunta">
              <Send size={16} aria-hidden="true" />
            </button>
          </form>
        </aside>
      )}

      <button
        type="button"
        className="financial-assistant-launcher"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Fechar assistente financeiro" : "Abrir assistente financeiro"}
        title="Assistente financeiro"
      >
        {open ? <X size={20} aria-hidden="true" /> : <MessageCircle size={20} aria-hidden="true" />}
      </button>
    </>
  );
}
