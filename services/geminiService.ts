
import { GoogleGenAI, Type } from "@google/genai";
import { DocumentAnalysis } from "../types";

export const analyzeDocument = async (base64Image: string): Promise<DocumentAnalysis> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const prompt = `
    請分析這張文件圖像：
    1. 簡要描述這是什麼文件。
    2. 識別簽名行或「在此簽名」區域的坐標（相對於圖像寬度和高度，範圍為 0 到 1000）。
    請用繁體中文回答。
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: "image/png",
              data: base64Image.split(',')[1],
            },
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            suggestedPlacements: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  x: { type: Type.NUMBER, description: "X 坐標 0-1000" },
                  y: { type: Type.NUMBER, description: "Y 坐標 0-1000" },
                },
                required: ["x", "y"],
              },
            },
          },
          required: ["description", "suggestedPlacements"],
        },
      },
    });

    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini 分析錯誤:", error);
    return {
      description: "無法分析文件內容。",
      suggestedPlacements: [],
    };
  }
};
