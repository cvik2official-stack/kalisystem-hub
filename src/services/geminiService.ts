import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Item, ParsedItem, Order } from '../types';

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
      4.  **CRITICAL UNIT HANDLING**: If an item is matched (you are returning 'matchedItemId'), you MUST NOT include the 'unit' field in the response for that item. The correct unit will be retrieved from the database. If an item is NOT matched (you are returning 'newItemName'), you SHOULD include the 'unit' field if you can parse one from the text.
      
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