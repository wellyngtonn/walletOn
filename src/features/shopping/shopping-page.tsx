"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Barcode, Camera, Check, Copy, ScanLine, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useShoppingList } from "@/hooks/useShoppingList";
import {
  archiveShoppingItems,
  createShoppingItem,
  deleteShoppingItem,
  ensureShoppingHistory,
  updateShoppingItem,
} from "@/services/shopping";
import type {
  ShoppingHistory,
  ShoppingItem,
  ShoppingItemInput,
} from "@/types";
import { currency, dateBR } from "@/utils/format";
import { INITIAL_SHOPPING_HISTORY } from "@/features/shopping/historical-data";

type ShopTab = "ativa" | "historico";

type BarcodeDetection = { rawValue?: string };
type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<BarcodeDetection[]>;
};
type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorLike;

const BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function priceValue(value: string) {
  const text = value.trim();
  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : text;
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function itemInput(item: ShoppingItem, changes: Partial<ShoppingItemInput> = {}): ShoppingItemInput {
  const data = { ...item } as Record<string, unknown>;
  delete data.id;
  delete data.userId;
  return { ...data, ...changes } as ShoppingItemInput;
}

export function ShoppingPage() {
  const { user } = useAuth();
  const { items, history: savedHistory, loading, error } = useShoppingList();
  const [tab, setTab] = useState<ShopTab>("ativa");
  const [barcode, setBarcode] = useState("");
  const [barcodeStatus, setBarcodeStatus] = useState<"loading" | "ok" | "warn" | "err" | "">("");
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [actionError, setActionError] = useState("");
  const [copiedHistoryId, setCopiedHistoryId] = useState<string | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPrice, setEditingPrice] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const copyFeedbackTimer = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerStreamRef = useRef<MediaStream | null>(null);
  const scannerTimerRef = useRef<number | null>(null);
  const lookupControllerRef = useRef<AbortController | null>(null);
  const lookupRequestRef = useRef(0);
  const barcodeCacheRef = useRef<Map<string, string | null>>(new Map());

  useEffect(() => () => {
    if (copyFeedbackTimer.current) window.clearTimeout(copyFeedbackTimer.current);
  }, []);

  const releaseScanner = useCallback(() => {
    if (scannerTimerRef.current !== null) {
      window.clearTimeout(scannerTimerRef.current);
      scannerTimerRef.current = null;
    }
    scannerStreamRef.current?.getTracks().forEach((track) => track.stop());
    scannerStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  }, []);

  const closeScanner = useCallback(() => {
    releaseScanner();
    setScannerOpen(false);
    setScannerError("");
  }, [releaseScanner]);

  useEffect(() => () => {
    releaseScanner();
    lookupControllerRef.current?.abort();
  }, [releaseScanner]);

  const activeItems = useMemo(
    () =>
      items
        .filter((item) => !item.done)
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR") || a.createdDate.localeCompare(b.createdDate)),
    [items],
  );
  const completedItems = useMemo(() => items.filter((item) => item.done), [items]);
  const total = activeItems.reduce((sum, item) => sum + item.qty * item.price, 0);
  const history = useMemo<ShoppingHistory[]>(() => {
    const records = new Map<string, ShoppingHistory>();

    function addRecord(record: ShoppingHistory) {
      const current = records.get(record.date);
      if (!current) {
        records.set(record.date, {
          ...record,
          items: [...record.items],
        });
        return;
      }
      current.total += record.total;
      current.items.push(...record.items);
    }

    savedHistory.forEach(addRecord);

    const groups = new Map<string, ShoppingItem[]>();
    completedItems.forEach((item) => {
      const key = item.completedDate || todayString();
      groups.set(key, [...(groups.get(key) || []), item]);
    });
    groups.forEach((groupedItems, date) => {
      addRecord({
        id: `pending-${date}`,
        userId: user?.uid || "",
        date,
        total: groupedItems.reduce((sum, item) => sum + item.qty * item.price, 0),
        items: groupedItems.map((item) => ({
          name: item.name,
          qty: item.qty,
          price: item.price,
        })),
      });
    });

    return [...records.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [completedItems, savedHistory, user?.uid]);

  useEffect(() => {
    if (!user) return;
    void ensureShoppingHistory(user.uid, INITIAL_SHOPPING_HISTORY).catch((exception) => {
      setActionError(exception instanceof Error ? exception.message : "Não foi possível salvar o histórico.");
    });
  }, [user]);

  const lookupProduct = useCallback(async (rawCode: string) => {
    const code = rawCode.replace(/\D/g, "");
    if (code.length < 8 || code.length > 14) return;

    const cachedName = barcodeCacheRef.current.get(code);
    if (cachedName !== undefined) {
      if (cachedName) {
        setName(cachedName);
        setBarcodeStatus("ok");
        nameRef.current?.focus();
      } else {
        setBarcodeStatus("warn");
      }
      return;
    }

    lookupControllerRef.current?.abort();
    const controller = new AbortController();
    lookupControllerRef.current = controller;
    const requestId = ++lookupRequestRef.current;
    setBarcodeStatus("loading");

    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}?fields=product_name,product_name_pt,abbreviated_product_name`,
        { signal: controller.signal },
      );
      if (!response.ok) throw new Error("barcode");
      const data = await response.json();
      const product = data.product;
      const productName = String(
        product?.product_name_pt || product?.product_name || product?.abbreviated_product_name || "",
      ).trim();
      if (requestId !== lookupRequestRef.current) return;
      barcodeCacheRef.current.set(code, productName || null);
      if (!productName) {
        setBarcodeStatus("warn");
        return;
      }
      setName(productName);
      setBarcodeStatus("ok");
      nameRef.current?.focus();
    } catch {
      if (!controller.signal.aborted && requestId === lookupRequestRef.current) {
        setBarcodeStatus("err");
      }
    }
  }, []);

  useEffect(() => {
    if (barcode.length < 8 || barcode.length > 14) {
      setBarcodeStatus("");
      return;
    }
    const timer = window.setTimeout(() => void lookupProduct(barcode), 120);
    return () => window.clearTimeout(timer);
  }, [barcode, lookupProduct]);

  useEffect(() => {
    if (!scannerOpen) return;

    let cancelled = false;
    const detectorConstructor = (
      window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }
    ).BarcodeDetector;

    if (!detectorConstructor) {
      setScannerError("A leitura por câmera não é suportada neste navegador. Use o campo ou um leitor físico.");
      return () => undefined;
    }
    const Detector = detectorConstructor;

    async function startScanner() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        scannerStreamRef.current = stream;
        const video = videoRef.current;
        if (!video) throw new Error("camera-view");
        video.srcObject = stream;
        await video.play();
        const detector = new Detector({ formats: BARCODE_FORMATS });

        const scan = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const detections = await detector.detect(videoRef.current);
            const code = detections
              .map((detection) => detection.rawValue || "")
              .map((value) => value.replace(/\D/g, ""))
              .find((value) => value.length >= 8 && value.length <= 14);
            if (code) {
              setBarcode(code);
              closeScanner();
              return;
            }
          } catch {
            // A frame can fail while the camera is adjusting focus; continue scanning.
          }
          if (!cancelled) scannerTimerRef.current = window.setTimeout(() => void scan(), 80);
        };

        void scan();
      } catch (exception) {
        if (!cancelled) {
          setScannerError(
            exception instanceof DOMException && exception.name === "NotAllowedError"
              ? "Permita o acesso à câmera para ler o código."
              : "Não foi possível iniciar a câmera. Confira as permissões do navegador.",
          );
        }
      }
    }

    void startScanner();
    return () => {
      cancelled = true;
      releaseScanner();
    };
  }, [closeScanner, releaseScanner, scannerOpen]);

  async function addItem() {
    if (!user || !name.trim()) {
      setActionError("Digite o nome do item.");
      return;
    }
    const parsedPrice = priceValue(price);
    if (parsedPrice === null) {
      setActionError("Informe um preço válido.");
      return;
    }
    setActionError("");
    const nextOrder = items.reduce((max, item) => Math.max(max, item.order), -1) + 1;
    try {
      await createShoppingItem(user.uid, {
        name: name.trim(),
        qty: Math.max(1, Math.trunc(Number(qty) || 1)),
        price: parsedPrice,
        done: false,
        createdDate: todayString(),
        completedDate: null,
        order: nextOrder,
      });
      setBarcode("");
      setName("");
      setQty("1");
      setPrice("");
      nameRef.current?.focus();
    } catch (exception) {
      setActionError(exception instanceof Error ? exception.message : "Não foi possível adicionar o item.");
    }
  }

  function moveToNextInput(
    event: React.KeyboardEvent<HTMLInputElement>,
    next: React.RefObject<HTMLInputElement | null>,
  ) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    next.current?.focus();
  }

  function submitWithEnter(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void addItem();
  }

  async function toggleItem(item: ShoppingItem) {
    if (!user) return;
    try {
      await updateShoppingItem(user.uid, item.id, itemInput(item, {
        done: !item.done,
        completedDate: !item.done ? todayString() : null,
      }));
    } catch (exception) {
      setActionError(exception instanceof Error ? exception.message : "Não foi possível atualizar o item.");
    }
  }

  async function removeItem(item: ShoppingItem) {
    if (!user) return;
    try {
      await deleteShoppingItem(user.uid, item.id);
    } catch (exception) {
      setActionError(exception instanceof Error ? exception.message : "Não foi possível excluir o item.");
    }
  }

  async function archiveCompleted() {
    if (!user || !completedItems.length || archiving) return;
    setArchiving(true);
    try {
      await archiveShoppingItems(user.uid, completedItems);
      setActionError("");
    } catch (exception) {
      setActionError(exception instanceof Error ? exception.message : "Não foi possível arquivar a lista.");
    } finally {
      setArchiving(false);
    }
  }

  function historyText(record: ShoppingHistory) {
    const lines = [...record.items]
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
      .map((item) => `${item.qty}x ${item.name}${item.price ? ` — ${currency(item.price)} cada` : ""}`);

    return [`*${record.date ? dateBR(record.date) : "Sem data"}*`, `*${currency(record.total)}*`, ...lines].join("\n");
  }

  async function copyHistory(record: ShoppingHistory) {
    try {
      const text = historyText(record);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("clipboard");
      }

      if (copyFeedbackTimer.current) window.clearTimeout(copyFeedbackTimer.current);
      setCopiedHistoryId(record.id);
      copyFeedbackTimer.current = window.setTimeout(() => setCopiedHistoryId(null), 1800);
      setActionError("");
    } catch {
      setActionError("Não foi possível copiar esta compra.");
    }
  }

  function beginPriceEdit(item: ShoppingItem) {
    setEditingPriceId(item.id);
    setEditingPrice(String(item.price || ""));
  }

  async function savePrice(item: ShoppingItem) {
    const parsedPrice = priceValue(editingPrice);
    if (!user || parsedPrice === null) {
      setActionError("Informe um preço válido.");
      return;
    }
    setActionError("");
    try {
      await updateShoppingItem(user.uid, item.id, itemInput(item, { price: parsedPrice }));
      setEditingPriceId(null);
    } catch (exception) {
      setActionError(exception instanceof Error ? exception.message : "Não foi possível salvar o preço.");
    }
  }

  if (loading) return <p className="text-[var(--text3)]">Carregando lista de compras...</p>;
  if (error) return <div className="msg-error">{error}</div>;

  return (
    <section className="shopping-page">
      <div className="sec-header shopping-header">
        <h2 className="sec-title">Lista de Compras</h2>
        <div className="shop-header-buttons">
          <button className="btn-outline btn-sm" type="button" onClick={() => setTab("historico")}>📋 Histórico</button>
          <button className="btn-outline btn-sm" type="button" onClick={() => void archiveCompleted()} disabled={archiving || !completedItems.length}>{archiving ? "Arquivando..." : "Arquivar concluídas"}</button>
        </div>
      </div>

      <div className="shop-tabs" role="tablist" aria-label="Lista de compras">
        <button className={`shop-tab ${tab === "ativa" ? "active" : ""}`} type="button" onClick={() => setTab("ativa")}>Compras Ativas</button>
        <button className={`shop-tab ${tab === "historico" ? "active" : ""}`} type="button" onClick={() => setTab("historico")}>Histórico</button>
      </div>

      {tab === "ativa" ? (
        <div className="shop-tab-content active">
          <div className="widget widget--full">
            <form
              className="shop-add"
              onSubmit={(event) => {
                event.preventDefault();
                void addItem();
              }}
            >
              <div className="barcode-wrap">
                <Barcode className="barcode-icon" size={16} aria-hidden="true" />
                <button
                  className="barcode-scan-button"
                  type="button"
                  onClick={() => {
                    setScannerError("");
                    setScannerOpen(true);
                  }}
                  aria-label="Ler código de barras com a câmera"
                  title="Ler com câmera"
                >
                  <ScanLine size={16} aria-hidden="true" />
                </button>
                <input className="shop-input shop-input--barcode" value={barcode} onChange={(event) => setBarcode(event.target.value.replace(/\D/g, ""))} onKeyDown={(event) => moveToNextInput(event, nameRef)} placeholder="Cód. de barras" inputMode="numeric" enterKeyHint="next" maxLength={14} />
                {barcodeStatus && <span className={`barcode-status ${barcodeStatus}`} aria-label={`Busca de código: ${barcodeStatus}`}>{barcodeStatus === "loading" ? "●" : barcodeStatus === "ok" ? "✓" : barcodeStatus === "warn" ? "?" : "×"}</span>}
              </div>
              <input ref={nameRef} className="shop-input" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => moveToNextInput(event, qtyRef)} placeholder="Item..." enterKeyHint="next" />
              <input ref={qtyRef} className="shop-input shop-input--sm" type="number" min="1" value={qty} onChange={(event) => setQty(event.target.value)} onKeyDown={(event) => moveToNextInput(event, priceRef)} placeholder="Qtd" enterKeyHint="next" />
              <input ref={priceRef} className="shop-input shop-input--sm" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} onKeyDown={submitWithEnter} placeholder="R$" enterKeyHint="done" />
              <button className="btn-primary btn-sm" type="submit">Adicionar</button>
            </form>

            {actionError && <div className="msg-error mb-3">{actionError}</div>}

            <div className="shop-summary">
              <div className="shop-summary-item"><span className="shop-summary-label">Total Estimado</span><strong className="shop-summary-value">{currency(total)}</strong></div>
              <div className="shop-summary-item"><span className="shop-summary-label">Itens</span><strong className="shop-summary-value">{activeItems.length}</strong></div>
            </div>

            <div className="shop-list">
              {!activeItems.length ? <div className="tx-empty">Lista vazia. Adicione itens para começar!</div> : activeItems.map((item) => (
                <div key={item.id} className="shop-item">
                  <button className="shop-check" type="button" onClick={() => void toggleItem(item)} aria-label={`Concluir ${item.name}`}>◯</button>
                  <div className="shop-info"><span className="shop-name">📦 {item.name}</span><div className="shop-qty-row"><span className="shop-qty">{item.qty}x</span>{editingPriceId === item.id ? <div className="shop-price-editor"><input autoFocus className="shop-price-input" type="number" min="0" step="0.01" value={editingPrice} onChange={(event) => setEditingPrice(event.target.value)} onBlur={(event) => { if (!(event.relatedTarget as HTMLElement | null)?.classList.contains("shop-price-action")) void savePrice(item); }} onKeyDown={(event) => { if (event.key === "Enter") void savePrice(item); if (event.key === "Escape") setEditingPriceId(null); }} /><button className="shop-price-action shop-price-action--ghost" type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setEditingPriceId(null)} aria-label="Cancelar edição"><X size={13} /></button></div> : <button className="shop-price-btn" type="button" onClick={() => beginPriceEdit(item)}>{item.price > 0 ? currency(item.price) : "Definir preço"}</button>}</div></div>
                  <span className="shop-total">{currency(item.qty * item.price)}</span>
                  <button className="tx-del" type="button" onClick={() => void removeItem(item)} aria-label={`Excluir ${item.name}`}>×</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="shop-tab-content active">
          <div className="widget widget--full"><div className="shop-historico">
            {!history.length ? <p className="tx-empty">Nenhuma lista concluída</p> : history.map((record) => (
              <div className="shop-historico-item" key={record.id}>
                <div className="shop-historico-header">
                  <div className="shop-historico-summary">
                    <span className="shop-historico-date">{record.date ? dateBR(record.date) : "Sem data"}</span>
                    <span className="shop-historico-total">{currency(record.total)}</span>
                  </div>
                  <button
                    className="btn-outline btn-sm shop-copy-button"
                    type="button"
                    onClick={() => void copyHistory(record)}
                    aria-label={`Copiar compra de ${record.date ? dateBR(record.date) : "data não informada"}`}
                  >
                    {copiedHistoryId === record.id ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                    {copiedHistoryId === record.id ? "Copiado" : "Copiar"}
                  </button>
                </div>
                <ul className="shop-historico-items">
                  {[...record.items]
                    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                    .map((item, index) => (
                      <li className="shop-historico-line" key={`${item.name}-${index}`}>
                        <span>{item.qty}x {item.name}</span>
                        {item.price ? (
                          <span className="shop-historico-line-price">
                            {currency(item.price)} cada
                          </span>
                        ) : null}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
          </div></div>
        </div>
      )}

      {scannerOpen && (
        <div className="barcode-scanner-overlay" role="presentation">
          <div className="barcode-scanner-modal" role="dialog" aria-modal="true" aria-labelledby="barcode-scanner-title">
            <div className="barcode-scanner-header">
              <div>
                <h3 id="barcode-scanner-title" className="barcode-scanner-title">
                  <Camera size={17} aria-hidden="true" /> Ler código
                </h3>
                <p className="barcode-scanner-caption">Aponte a câmera para o código do produto.</p>
              </div>
              <button className="modal-close" type="button" onClick={closeScanner} aria-label="Fechar leitor">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="barcode-scanner-viewfinder">
              <video ref={videoRef} autoPlay muted playsInline />
              <span className="barcode-scanner-guide" aria-hidden="true" />
            </div>
            {scannerError ? <p className="msg-error barcode-scanner-error">{scannerError}</p> : <p className="barcode-scanner-hint">A leitura começa automaticamente.</p>}
          </div>
        </div>
      )}
    </section>
  );
}
