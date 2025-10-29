import { GoogleGenAI, Type } from "@google/genai";
import { Item, ParsedItem, Unit } from '../types';

const parseItemListWithGemini = async (text: string, existingItems: Item[]): Promise<ParsedItem[]> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const prompt = `
        Parse the following user-provided list of items. For each item, match it against the provided list of existing items.
        
        Rules:
        1.  If a direct or very close match is found in the existing items, use the 'matchedItemId' and provide its ID. Do not guess if the match is not confident.
        2.  If no confident match is found, treat it as a new item and use 'newItemName'. Provide a concise, clean name for it.
        3.  Extract the quantity for every item. This can be a decimal.
        4.  Extract the unit of measurement if specified. Normalize common terms: bottle=bt; pax, pack=pk; liter(s)=L; pcs=pc. If not specified, leave it out.
        5.  The final output must be only the JSON array. Do not include any other text or markdown formatting.

        Existing Items for matching (JSON format):
        ${JSON.stringify(existingItems.map(item => ({ id: item.id, name: item.name })))}

        User's list to parse:
        ---
        ${text}
        ---
    `;

    const responseSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                matchedItemId: { type: Type.STRING, description: "ID of the matched existing item." },
                newItemName: { type: Type.STRING, description: "Name of a new, unrecognized item." },
                variant: { type: Type.STRING, description: "Variant of the new item, if any." },
                quantity: { type: Type.NUMBER, description: "The quantity of the item." },
                unit: { type: Type.STRING, description: `The unit of measurement. Must be one of: ${Object.values(Unit).join(', ')}` },
            },
        },
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });
        
        let responseText = response.text.trim();
        // Strip markdown fences
        if (responseText.startsWith('```json')) {
            responseText = responseText.substring(7, responseText.length - 3).trim();
        } else if (responseText.startsWith('```')) {
            responseText = responseText.substring(3, responseText.length - 3).trim();
        }

        const parsedJson = JSON.parse(responseText);

        if (!Array.isArray(parsedJson)) {
            throw new Error("Gemini response was not a JSON array.");
        }

        return parsedJson as ParsedItem[];
    } catch (error) {
        console.error("Error parsing items with Gemini:", error);
        if (error instanceof SyntaxError) {
             throw new Error("Failed to parse the item list. The AI model returned an invalid format.");
        }
        throw new Error("Failed to parse the item list. The AI model might be unavailable or the format was incorrect.");
    }
};

export default parseItemListWithGemini;