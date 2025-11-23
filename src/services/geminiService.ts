import { GoogleGenAI, Type } from "@google/genai";
import { Item, ParsedItem, Unit, StoreName } from '../types';

export const DEFAULT_AI_PARSING_RULES: { global: Record<string, string>, stores: Record<string, Record<string, string>> } = {
    global: {
        "Chicken": "Chicken breast",
        "Beef": "Beef (rump)",
        "Mushroom can": "Mushroom",
        "Cabbage": "Cabbage (white)",
        "chocolate syrup": "chocolate topping",
        "pizza flour": "flour (25kg)",
        "mushroom": "Mushroom fresh",
        "mushrooms": "Mushroom fresh",
        "mushrooms white": "Mushroom fresh",
        "french fries": "French fries (crinkle cut - GUD)",
    },
    stores: {
        [StoreName.SHANTI]: {
            "french fries": "french fries (straight cut - NOWACO)"
        },
        [StoreName.CV2]: {
             "cucumber": "cucumber long"
        }
    }
};

const parseItemListWithGemini = async (
  text: string,
  existingItems: Item[],
  apiKey: string,
  aiRules?: { aliases: Record<string, string> },
  storeName?: string
): Promise<ParsedItem[]> => {
  if (!apiKey) {
    throw new Error("Gemini API key is not configured. Please add it in Settings.");
  }
  
  const validUnits = Object.values(Unit);

  // Merge defaults with user rules
  let combinedAliases = { ...DEFAULT_AI_PARSING_RULES.global };
  
  // Apply store specific defaults if applicable
  if (storeName && DEFAULT_AI_PARSING_RULES.stores[storeName]) {
      combinedAliases = { ...combinedAliases, ...DEFAULT_AI_PARSING_RULES.stores[storeName] };
  }

  // Apply user overrides (they take precedence)
  if (aiRules && aiRules.aliases) {
      combinedAliases = { ...combinedAliases, ...aiRules.aliases };
  }

  let aliasingRulesString = "No custom aliases provided.";
  if (Object.keys(combinedAliases).length > 0) {
      aliasingRulesString = Object.entries(combinedAliases)
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
      4.  **SPECIAL QUANTITY RULE**: If the user asks for "Mayonnaise" (or "mayo"), you MUST ignore any quantity specified in the text and ALWAYS return a quantity of 6 and a unit of "pc". For example, "mayo x2" or "1 mayonnaise" must both result in \`{"quantity": 6, "unit": "pc"}\` when parsed.
      5.  **COMPLEX EXPANSION RULE**: If the user input contains "Red+green+yellow 1 kg" (or similar variations implying a mix of 3 bell peppers), you MUST expand this into THREE separate items in the output list:
          - "Red bell pepper" with quantity 2 and unit "pc"
          - "Green bell pepper" with quantity 2 and unit "pc"
          - "Yellow bell pepper" with quantity 2 and unit "pc"
      6.  **CRITICAL UNIT RULE**: This is the most important rule. You must follow it precisely.
          -   **For Matched Items (using 'matchedItemId'):** You MUST OMIT the 'unit' field entirely in the JSON output. The database already has the correct unit. Do NOT return a unit for these items.
          -   **For New Items (using 'newItemName'):** If you can identify a unit, you MUST normalize it to one of the following exact, lowercase, singular values: ${validUnits.join(', ')}.
          -   **MANDATORY NORMALIZATION EXAMPLES:**
              -   User input like "pcs", "pieces", "piece" MUST become "pc".
              -   User input like "kgs", "kilos", "kilogram" MUST become "kg".
              -   User input like "boxs", "bx" MUST become "box".
              -   User input like "rolls" MUST become "roll".
              -   User input like "btls", "bottle", "bottles" MUST become "bt".
          -   If no unit is found for a new item, omit the 'unit' field.
      7.  **CUSTOM ALIASING RULES**: Apply these specific aliases. If the user text contains the key, you should treat it as the value for matching purposes.
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

export default parseItemListWithGemini;