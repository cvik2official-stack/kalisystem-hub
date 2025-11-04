import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Item, ParsedItem, Order, Unit } from '../types';

const parseItemListWithGemini = async (
  text: string,
  existingItems: Item[],
  apiKey: string,
  aiRules?: { aliases: Record<string, string> }
): Promise<ParsedItem[]> => {
  if (!apiKey) {
    throw new Error("Gemini API key is not configured. Please add it in Settings.");
  }
  
  const validUnits = Object.values(Unit);

  let aliasingRulesString = "No custom aliases provided.";
  if (aiRules && aiRules.aliases && Object.keys(aiRules.aliases).length > 0) {
      aliasingRulesString = Object.entries(aiRules.aliases)
          .map(([key, value]) => `- "${key}" should be treated as "${value}".`)
          .join('\n');
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
      4.  **CRITICAL UNIT RULE**: This is the most important rule. You must follow it precisely.
          -   **For Matched Items (using 'matchedItemId'):** You MUST OMIT the 'unit' field entirely in the JSON output. The database already has the correct unit. Do NOT return a unit for these items.
          -   **For New Items (using 'newItemName'):** If you can identify a unit, you MUST normalize it to one of the following exact, lowercase, singular values: ${validUnits.join(', ')}.
          -   **MANDATORY NORMALIZATION EXAMPLES:**
              -   User input like "pcs", "pieces", "piece" MUST become "pc".
              -   User input like "kgs", "kilos", "kilogram" MUST become "kg".
              -   User input like "boxs", "bx" MUST become "box".
              -   User input like "rolls" MUST become "roll".
              -   User input like "btls", "bottle", "bottles" MUST become "bt".
          -   If no unit is found for a new item, omit the 'unit' field.
      5.  **CUSTOM ALIASING RULES**: Apply these specific aliases. If the user text contains the key, you should treat it as the value for matching purposes.
          ${aliasingRulesString}
      
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
              unit: { type: Type.STRING, description: `The unit of the item (e.g., kg, pc, box). IMPORTANT: Provide this ONLY for new items (when using 'newItemName'). Omit this field entirely for matched items (when using 'matchedItemId'). If provided, the value MUST be one of: ${validUnits.join(', ')}.` },
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

export const generateInvoiceImage = async (order: Order, apiKey: string): Promise<string> => {
    if (!apiKey) {
        throw new Error("Gemini API key is not configured.");
    }

    try {
        const ai = new GoogleGenAI({ apiKey });
        
        const itemsList = order.items.map(item => `- ${item.name}: ${item.quantity} ${item.unit || ''}`).join('\n');
        
        const prompt = `Generate a professional, clean, black and white invoice image.
        
        Header: INVOICE
        
        Details Section (left aligned):
        - Order ID: ${order.orderId}
        - To: ${order.store}
        - From: ${order.supplierName}
        - Date: ${new Date(order.completedAt || order.createdAt).toLocaleDateString()}
        
        Items Section (a clean table):
        The table should have three columns: "Item Description", "Quantity", and "Unit".
        List the following items clearly in the table:
        ${itemsList}
        
        Footer:
        - Thank you for your business!
        - Kali System Dispatch
        
        Design requirements:
        - Use a clear, sans-serif font like Arial or Helvetica.
        - The layout should be professional and easy to read.
        - Strictly black and white, no colors.
        - Ensure good contrast and legibility.
        - The image aspect ratio should be portrait, like a standard A4 paper.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: { parts: [{ text: prompt }] },
            config: {
                responseModalities: [Modality.IMAGE],
            },
        });

        const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);
        if (!imagePart || !imagePart.inlineData) {
            throw new Error("AI did not return an image.");
        }
        
        return imagePart.inlineData.data;

    } catch (error: any) {
        console.error("Error generating invoice image with Gemini:", error);
        throw new Error("Failed to generate invoice image.");
    }
};


export default parseItemListWithGemini;