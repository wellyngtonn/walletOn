import { deleteObject, ref } from "firebase/storage";
import { storage } from "@/lib/firebase/config";

const RECEIPT_MAX_WIDTH = 1000;
const RECEIPT_QUALITY = 0.7;

export function receiptPath(uid: string, historyId: string) {
  return `users/${uid}/receipts/${historyId}.jpg`;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível processar a imagem."));
    image.src = source;
  });
}

export async function resizeReceiptImage(
  file: File,
  maxWidth = RECEIPT_MAX_WIDTH,
  quality = RECEIPT_QUALITY,
): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(1, maxWidth / image.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível processar a imagem.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) throw new Error("Não foi possível processar a imagem.");
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function deleteReceiptPhoto(uid: string, historyId: string) {
  const reference = ref(storage, receiptPath(uid, historyId));
  try {
    await deleteObject(reference);
  } catch (exception) {
    if ((exception as { code?: string })?.code !== "storage/object-not-found") {
      throw exception;
    }
  }
}
