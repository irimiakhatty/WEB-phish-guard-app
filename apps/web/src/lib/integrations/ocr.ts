import Tesseract from "tesseract.js";

let workerPromise: Promise<any> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker("eng", 1, {
      logger: (m: any) => {
        if (m?.status === "recognizing text") {
          console.log(`OCR Progress: ${Math.round((m.progress || 0) * 100)}%`);
        }
      },
    });
  }

  return workerPromise;
}

/**
 * Extracts text from an image file using Tesseract.js OCR
 * @param imageFile The image file object from input
 * @returns Promise resolving to the extracted text string
 */
export async function extractTextFromImage(
  imageFile: File
): Promise<string> {
  try {
    const worker = await getWorker();
    const result = await worker.recognize(imageFile);

    // Clean up the extracted text
    let text = result?.data?.text || "";
    
    // Remove excessive whitespace and newlines
    text = text.replace(/\s+/g, " ").trim();
    
    // Try to preserve important line breaks for email structure
    text = text.replace(/\s+(From:|To:|Subject:|Date:)/gi, "\n$1");
    
    return text;
  } catch (error) {
    console.error("OCR Error:", error);
    throw new Error("Failed to extract text from image.");
  }
}
