import { GoogleGenAI } from "@google/genai";
import { Item, ParsedItem } from '../types';

// Reverting to a simpler, more robust parsing function to address performance and accuracy issues.
const parseItemListWithGemini = async (text: string, existingItems: Item[], apiKey?: string): Promise<ParsedItem[]> => {
    if (!apiKey) {
        throw new Error("Gemini API key is not configured. AI parsing is disabled.");
    }

    // Initialize the AI client.
    const ai = new GoogleGenAI({ apiKey });

    // A more direct and streamlined prompt for better performance and reliability.
    const prompt = `
        You are an expert data parsing tool. Your task is to parse the user's text into a structured JSON array.
        Analyze the user's list and match each line against the provided "Existing Items Database".

        RULES:
        1. For each line in the user's list, determine the item name, quantity, and unit.
        2. If you find a confident match for the item name in the "Existing Items Database", use the 'matchedItemId' field with the corresponding ID.
        3. If you do not find a confident match, use the 'newItemName' field with a cleaned-up, concise item name.
        4. Always extract a 'quantity'. It must be a number. Default to 1 if not specified.
        5. If a unit of measurement is present (e.g., kg, pc, box), extract it into the 'unit' field.
        6. Your response MUST be a single, valid JSON array of objects and nothing else. Do not include any explanation or markdown formatting.

        EXISTING ITEMS DATABASE (for matching):
        ${JSON.stringify(existingItems.map(item => ({ id: item.id, name: item.name })))}

        USER'S LIST TO PARSE:
        ---
        ${text}
        ---
    `;

    try {
        // Using a simpler generateContent call without the strict schema for faster processing.
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        let responseText = response.text?.trim() ?? '';

        if (!responseText) {
            throw new Error("The AI model returned an empty response.");
        }

        // The model might still wrap the JSON in markdown, so we strip it.
        if (responseText.startsWith('```json')) {
            responseText = responseText.substring(7, responseText.length - 3).trim();
        } else if (responseText.startsWith('```')) {
            responseText = responseText.substring(3, responseText.length - 3).trim();
        }
        
        // The model might return a single object instead of an array for a single-item list.
        // We ensure it's always an array.
        if (responseText.startsWith('{')) {
            responseText = `[${responseText}]`;
        }

        const parsedJson = JSON.parse(responseText);

        if (!Array.isArray(parsedJson)) {
            throw new Error("AI response was not a valid JSON array.");
        }

        // Final validation to ensure the returned objects have the required 'quantity' field.
        return parsedJson.filter(item => item && typeof item.quantity === 'number') as ParsedItem[];

    } catch (error) {
        console.error("Error parsing items with Gemini:", error);
        if (error instanceof SyntaxError) {
             throw new Error("Failed to parse item list: The AI returned an invalid format.");
        }
        // Re-throw other errors with a user-friendly message.
        throw new Error("Failed to parse item list. The AI model may be unavailable or could not process the request.");
    }
};

export default parseItemListWithGemini;