import Tesseract from "tesseract.js";

export async function extractTextFromImage(buffer: Buffer, language = "eng"): Promise<string> {
  const result = await Tesseract.recognize(buffer, language);
  return result.data.text.trim();
}
