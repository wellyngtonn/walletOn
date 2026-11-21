import { resizeReceiptImage } from "@/services/receipt";
import { parseReceiptText } from "@/utils/receipt-parser";

export type { OcrItem } from "@/utils/receipt-parser";

export async function runReceiptOcr(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<{ items: ReturnType<typeof parseReceiptText>; text: string }> {
  const image = await resizeReceiptImage(file, 1600, 0.9);
  const { recognize } = await import("tesseract.js");
  const result = await recognize(image, "por", {
    logger: (message: { status?: string; progress?: number }) => {
      if (message.status === "recognizing text" && typeof message.progress === "number") {
        onProgress?.(message.progress);
      }
    },
  });
  const text = result.data.text;
  return { items: parseReceiptText(text), text };
}
