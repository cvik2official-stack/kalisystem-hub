import { GoogleGenAI, Type } from "@google/genai";
import { Item, ParsedItem } from '../types';

const parseItemListWithGemini = async (
  text: string,
  existingItems: Item[],
  apiKey: string // The API key is now passed directly
): Promise<ParsedItem[]> => {
  if (!apiKey) {
    throw new Error("Gemini API key is not configured. Please add it in Settings.");
  }
  
  try {
    // Initialize the Gemini client on the fly with the provided key
    const ai = new GoogleGenAI({ apiKey });

    // The prompt is now executed on the client-side
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Parse the following user-provided text into a list of items. For each item, identify its name, quantity, and unit.
      Then, match each parsed item to the closest item from the provided existing item database.
      
      RULES:
      1.  If a parsed item closely matches an item in the database, provide the 'matchedItemId' and its corresponding database ID. Use fuzzy matching. An item like "Angkor beer" should match "Angkor Beer (can)".
      2.  If a parsed item does not match any existing item, provide the 'newItemName' with the name you parsed from the text. These are likely unique items, special requests, or typos.
      3.  Always provide a quantity. Default to 1 if not specified.
      4.  **CRITICAL**: For items that have a 'matchedItemId', DO NOT return a 'unit' in the JSON object. The system will use the correct unit from the database. For items with 'newItemName', you SHOULD infer the 'unit' from the text if possible (e.g., 'kg', 'pc', 'box').
      
      EXISTING ITEM DATABASE (for matching):
      ${JSON.stringify(existingItems.map(item => ({ id: item.id, name: item.name, supplier: item.supplierName, unit: item.unit })))}
      
      USER TEXT TO PARSE:
      ---
      ${text}
      ---
      `,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              matchedItemId: { type: Type.STRING, description: "The ID of the matched item from the database." },
              newItemName: { type: Type.STRING, description: "The name of the item if no match was found." },
              quantity: { type: Type.NUMBER, description: "The quantity of the item." },
              unit: { type: Type.STRING, description: "The unit of the item (e.g., kg, pc, box)." },
            },
          },
        },
      },
    });
    
    const jsonStr = response.text.trim();
    const parsedResult = JSON.parse(jsonStr);
    
    if (!Array.isArray(parsedResult)) {
        throw new Error("AI response was not in the expected array format.");
    }
    
    return parsedResult as ParsedItem[];

  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    if (error.toString().includes('API key not valid')) {
        throw new Error("The configured Gemini API key is invalid. Please check it in Settings.");
    }
    throw new Error("AI parsing failed. Check the browser console for more details.");
  }
};

export default parseItemListWithGemini;