import { GoogleGenAI, Type } from "@google/genai";
import { Item, ParsedItem, Unit } from '../types';

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
    const ai = new GoogleGenAI({ apiKey });

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

export const generateReceiptTemplateHtml = async (apiKey: string): Promise<string> => {
    if (!apiKey) {
        throw new Error("Gemini API key is not configured.");
    }

    // FIX: Initialize the Gemini client outside the try...catch block to ensure it's properly scoped.
    const ai = new GoogleGenAI({ apiKey });

    try {
        // FIX: The prompt string was potentially causing parsing errors.
        // Re-written to ensure placeholders are treated as plain text by the TypeScript compiler.
        const prompt = `
        Generate a single block of HTML and inline CSS for a receipt template.
        The design should mimic a receipt from an 80mm thermal printer: narrow, single-column, and using a monospace font.
        The template MUST be self-contained (no external stylesheets) and use placeholders for dynamic content.

        **CRITICAL INSTRUCTIONS:**
        1.  The entire output must be a single HTML string.
        2.  Use a common monospace font like 'Courier New', 'Lucida Console', or 'monospace'.
        3.  The layout must be narrow, simulating an 80mm receipt. Use a container div with a 'max-width' of around 300px.
        4.  Use the EXACT placeholders specified below, enclosed in double curly braces, e.g., {{store}}.

        **Required Placeholders:**
        -   {{store}}: The name of the store receiving the order.
        -   {{supplierName}}: The name of the supplier.
        -   {{orderId}}: The human-readable order ID.
        -   {{date}}: The completion date of the order.
        -   {{items}}: This is a placeholder for the table body rows. It will be replaced by a series of '<tr>...</tr>' strings.
        -   {{grandTotal}}: The final total amount of the invoice.
        -   {{paymentMethod}}: The payment method used (e.g., CASH, KALI).

        **Template Structure:**
        -   A header with the title "INVOICE".
        -   A section for details (Order ID, To, From, Date).
        -   A table for items with columns: "Item", "Qty", "Price", "Total".
        -   The table body should contain only the {{items}} placeholder.
        -   A footer section displaying the "GRAND TOTAL" and the "PAID BY" information.
        -   A final closing message, like "Thank you for your business!".

        Here is an example of the kind of HTML structure I expect for the items table:
        \`\`\`html
        <table>
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                {{items}}
            </tbody>
        </table>
        \`\`\`
        Now, generate the complete HTML document based on these requirements.
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        const template = response.text
          .replace(/```html/g, '')
          .replace(/```/g, '')
          .trim();
        
        return template;

    } catch (error: any) {
        console.error("Error generating receipt template with Gemini:", error);
        throw new Error("Failed to generate receipt template.");
    }
};

export default parseItemListWithGemini;
