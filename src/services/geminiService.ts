import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface Recipe {
  title: string;
  description: string;
  ingredients: string[];
  instructions: string[];
  cuisine: string;
  difficulty: string;
  time: string;
  nutrition?: {
    calories: number;
    protein: string;
    carbs: string;
    fat: string;
  };
}

export async function generateRecipe(ingredients: string[], preferredCuisine?: string): Promise<Recipe> {
  const model = "gemini-3-flash-preview";
  const prompt = `Generate a professional recipe using some or all of these ingredients: ${ingredients.join(', ')}. ${preferredCuisine ? `The user prefers ${preferredCuisine} cuisine.` : ''} Provide the response in JSON format. Include nutritional information per serving.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
          instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
          cuisine: { type: Type.STRING },
          difficulty: { type: Type.STRING },
          time: { type: Type.STRING },
          nutrition: {
            type: Type.OBJECT,
            properties: {
              calories: { type: Type.NUMBER },
              protein: { type: Type.STRING },
              carbs: { type: Type.STRING },
              fat: { type: Type.STRING },
            },
            required: ["calories", "protein", "carbs", "fat"],
          },
        },
        required: ["title", "ingredients", "instructions", "nutrition"],
      },
    },
  });

  return JSON.parse(response.text || '{}');
}

export async function searchRecipeByName(query: string): Promise<Recipe> {
  const model = "gemini-3-flash-preview";
  const prompt = `Act as a world-class culinary analyst. Analyze or generate a professional recipe based on this input: "${query}". 
  If the input is just a dish name, generate a high-quality recipe for it. 
  If the input is a full recipe, analyze its nutritional content and structure it.
  In both cases, include:
  1. A detailed description highlighting the health benefits and flavor profile.
  2. Full nutritional information per serving.
  3. Clear ingredients and instructions.
  Provide the response in JSON format.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
          instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
          cuisine: { type: Type.STRING },
          difficulty: { type: Type.STRING },
          time: { type: Type.STRING },
          nutrition: {
            type: Type.OBJECT,
            properties: {
              calories: { type: Type.NUMBER },
              protein: { type: Type.STRING },
              carbs: { type: Type.STRING },
              fat: { type: Type.STRING },
            },
            required: ["calories", "protein", "carbs", "fat"],
          },
        },
        required: ["title", "ingredients", "instructions", "nutrition"],
      },
    },
  });

  return JSON.parse(response.text || '{}');
}

export async function chatWithChef(
  message: string, 
  history: { role: "user" | "model", content: string, imageUrl?: string }[],
  context?: { fridge: string[], recipes: string[], profile: any },
  imageData?: { data: string, mimeType: string }
): Promise<string> {
  const model = "gemini-3-flash-preview";
  
  const contextPrompt = context ? `
    Current Kitchen Context:
    - Fridge Ingredients: ${context.fridge.join(', ') || 'Empty'}
    - Saved Recipes: ${context.recipes.join(', ') || 'None'}
    - User Preferences: ${context.profile?.preferredCuisine || 'None'}
  ` : '';

  const systemInstruction = `You are "Chef AI", a smart multimodal conversational assistant.
  - You understand and respond to text, voice, and image inputs.
  - Analyze the user's latest input and respond accordingly.
  - If an image is provided, identify the dish or ingredients and provide relevant info or recipes.
  - If the image is unrelated to food, respond helpfully based on what you see.
  - Respond naturally and conversationally in both Urdu and English, matching the user's tone.
  - For voice-like interactions, keep responses short, clear, and easy to speak.
  - Avoid fixed or repetitive replies. Generate dynamic, context-aware responses.
  - Follow the user's intent and topic changes instantly.
  ${contextPrompt}`;

  const contents: any[] = history.map(h => {
    const parts: any[] = [{ text: h.content }];
    if (h.imageUrl) {
      // Note: In a real app, we might need to fetch the image and convert to base64 if not already stored as such
      // For now, we assume the history only contains text for the model's memory, 
      // or we'd need to handle multi-part history.
    }
    return { role: h.role, parts };
  });

  const userParts: any[] = [{ text: message }];
  if (imageData) {
    userParts.push({
      inlineData: {
        data: imageData.data,
        mimeType: imageData.mimeType
      }
    });
  }

  contents.push({ role: "user", parts: userParts });

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction,
    }
  });

  return response.text || "I'm sorry, I couldn't process that.";
}

export async function predictCraving(mood: string, weather: string): Promise<string> {
  const model = "gemini-3-flash-preview";
  const prompt = `Based on the user's current mood (${mood}) and weather (${weather}), predict one specific dish they might be craving. Just return the name of the dish.`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text || 'Something delicious';
}

export async function analyzeTasteDNA(userPreferences: string): Promise<any> {
  const model = "gemini-3-flash-preview";
  const prompt = `Analyze the following user preferences and provide a "Taste DNA" profile with scores (0-100) for Sweetness, Saltiness, Spiciness, Umami, and Acidity. Return as JSON. Preferences: ${userPreferences}`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          sweetness: { type: Type.NUMBER },
          saltiness: { type: Type.NUMBER },
          spiciness: { type: Type.NUMBER },
          umami: { type: Type.NUMBER },
          acidity: { type: Type.NUMBER },
        },
        required: ["sweetness", "saltiness", "spiciness", "umami", "acidity"],
      },
    },
  });

  return JSON.parse(response.text || '{}');
}
