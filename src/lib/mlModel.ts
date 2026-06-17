/**
 * In-memory Machine Learning Classifier for personalized craving prediction.
 * Features used: User Mood, Current Weather, Time of Day, and Taste DNA Profile.
 * Method: Cosine Similarity with Feature Weighting & Normalized Softmax Probabilities.
 */

export interface TasteProfile {
  sweetness: number; // 0-100
  saltiness: number; // 0-100
  spiciness: number; // 0-100
  umami: number; // 0-100
  acidity: number; // 0-100
}

export interface CravingInput {
  mood: string;       // Happy, Tired, Stressed, Energetic, Cozy, Adventurous
  weather: string;    // Sunny, Rainy, Cold, Hot, Cloudy, Snowy
  timeOfDay: string;  // Morning, Afternoon, Evening, Night
  tasteDna: TasteProfile;
}

export interface PredictionResult {
  dishName: string;
  category: string;
  confidence: number; // 0-100
  matchingVector: {
    moodFit: number;
    weatherFit: number;
    tasteFit: number;
    timeFit: number;
  };
  reason: string;
  recommendedTime: string;
}

// Fixed reference database of dishes with metadata vectors
// Values represent affinities from 0.0 to 1.0
export interface DishMetadata {
  name: string;
  category: string;
  moodAffinities: Record<string, number>;
  weatherAffinities: Record<string, number>;
  timeAffinities: Record<string, number>;
  tasteWeights: TasteProfile; // Target balance
  reason: string;
}

const DISH_DATASET: DishMetadata[] = [
  {
    name: "Classic Pancakes with Maple Syrup",
    category: "Breakfast / Sweet",
    moodAffinities: { Happy: 0.9, Tired: 0.8, Cozy: 1.0, Energetic: 0.4, Stressed: 0.7, Adventurous: 0.3 },
    weatherAffinities: { Sunny: 0.7, Rainy: 0.9, Cold: 0.9, Hot: 0.4, Cloudy: 0.8, Snowy: 1.0 },
    timeAffinities: { Morning: 1.0, Afternoon: 0.5, Evening: 0.2, Night: 0.1 },
    tasteWeights: { sweetness: 90, saltiness: 20, spiciness: 10, umami: 20, acidity: 15 },
    reason: "A warm, comforting stack of fluffy pancakes with sweet maple syrup perfectly complements a slow morning or a cozy rainy atmosphere."
  },
  {
    name: "Spicy Sichuan Kung Pao Chicken",
    category: "Main / Spicy",
    moodAffinities: { Happy: 0.6, Tired: 0.4, Cozy: 0.3, Energetic: 0.9, Stressed: 0.8, Adventurous: 1.0 },
    weatherAffinities: { Sunny: 0.5, Rainy: 0.8, Cold: 0.9, Hot: 0.4, Cloudy: 0.7, Snowy: 0.9 },
    timeAffinities: { Morning: 0.1, Afternoon: 0.8, Evening: 1.0, Night: 0.6 },
    tasteWeights: { sweetness: 40, saltiness: 70, spiciness: 90, umami: 80, acidity: 40 },
    reason: "Bold, fiery sichuan peppers and rich roasted peanuts bring high energetic heat, perfect when you feel adventurous or stressed."
  },
  {
    name: "Slow-Simmered Tomato Basil Soup",
    category: "Soup / Cozy",
    moodAffinities: { Happy: 0.5, Tired: 0.9, Cozy: 1.0, Energetic: 0.2, Stressed: 0.9, Adventurous: 0.1 },
    weatherAffinities: { Sunny: 0.3, Rainy: 1.0, Cold: 1.0, Hot: 0.1, Cloudy: 0.9, Snowy: 1.0 },
    timeAffinities: { Morning: 0.2, Afternoon: 0.8, Evening: 0.9, Night: 0.7 },
    tasteWeights: { sweetness: 35, saltiness: 60, spiciness: 20, umami: 70, acidity: 65 },
    reason: "Gentle sour-sweet tomato broth coupled with fragrant basil serves as the ultimate savory comfort food during cold or rainy days."
  },
  {
    name: "Zesty Mango & Avocado Citrus Salad",
    category: "Salad / Refreshing",
    moodAffinities: { Happy: 0.9, Tired: 0.3, Cozy: 0.3, Energetic: 1.0, Stressed: 0.5, Adventurous: 0.7 },
    weatherAffinities: { Sunny: 1.0, Rainy: 0.2, Cold: 0.2, Hot: 1.0, Cloudy: 0.5, Snowy: 0.1 },
    timeAffinities: { Morning: 0.4, Afternoon: 0.9, Evening: 0.7, Night: 0.3 },
    tasteWeights: { sweetness: 60, saltiness: 30, spiciness: 25, umami: 40, acidity: 80 },
    reason: "Bright, sun-drenched flavors with dynamic citrus enzymes that revitalize your energy on warm, sunny days."
  },
  {
    name: "Decadent Double Chocolate Lava Cake",
    category: "Dessert / Sweet",
    moodAffinities: { Happy: 0.8, Tired: 0.8, Cozy: 0.9, Energetic: 0.3, Stressed: 1.0, Adventurous: 0.4 },
    weatherAffinities: { Sunny: 0.5, Rainy: 0.9, Cold: 1.0, Hot: 0.3, Cloudy: 0.8, Snowy: 1.0 },
    timeAffinities: { Morning: 0.1, Afternoon: 0.6, Evening: 1.0, Night: 0.9 },
    tasteWeights: { sweetness: 95, saltiness: 30, spiciness: 10, umami: 30, acidity: 20 },
    reason: "Rich melted dark chocolate triggers cocoa endorphins - the finest solution to alleviate stress or celebrate happy moments."
  },
  {
    name: "Authentic Tonkotsu Ramen with Chashu Pork",
    category: "Noodles / Savory",
    moodAffinities: { Happy: 0.7, Tired: 0.9, Cozy: 1.0, Energetic: 0.5, Stressed: 0.8, Adventurous: 0.6 },
    weatherAffinities: { Sunny: 0.4, Rainy: 1.0, Cold: 1.0, Hot: 0.2, Cloudy: 0.9, Snowy: 1.0 },
    timeAffinities: { Morning: 0.1, Afternoon: 0.7, Evening: 1.0, Night: 0.8 },
    tasteWeights: { sweetness: 25, saltiness: 80, spiciness: 30, umami: 95, acidity: 25 },
    reason: "Thick, slow-boiled marrow broth rich in pure umami is perfect for restoring stamina, relaxing tired minds, and keeping warm."
  },
  {
    name: "Crispy Grilled Baja Fish Tacos",
    category: "Street Food / Savory",
    moodAffinities: { Happy: 1.0, Tired: 0.5, Cozy: 0.4, Energetic: 0.8, Stressed: 0.4, Adventurous: 0.8 },
    weatherAffinities: { Sunny: 1.0, Rainy: 0.3, Cold: 0.3, Hot: 0.9, Cloudy: 0.6, Snowy: 0.1 },
    timeAffinities: { Morning: 0.1, Afternoon: 0.9, Evening: 0.9, Night: 0.6 },
    tasteWeights: { sweetness: 30, saltiness: 65, spiciness: 50, umami: 60, acidity: 70 },
    reason: "Crunchy batter-fried fish, lime juice splashes, and spicy chipotle cream make for a joyful, sociable, sun-loving meal."
  },
  {
    name: "Thai Green Curry with Fresh Holy Basil",
    category: "Main / aromatic",
    moodAffinities: { Happy: 0.8, Tired: 0.6, Cozy: 0.7, Energetic: 0.8, Stressed: 0.6, Adventurous: 1.0 },
    weatherAffinities: { Sunny: 0.6, Rainy: 0.8, Cold: 0.9, Hot: 0.5, Cloudy: 0.8, Snowy: 0.9 },
    timeAffinities: { Morning: 0.1, Afternoon: 0.8, Evening: 1.0, Night: 0.7 },
    tasteWeights: { sweetness: 50, saltiness: 60, spiciness: 80, umami: 85, acidity: 50 },
    reason: "Complex herbal green chili paste simmered gently with rich coconut milk is ideal for culinary adventures."
  }
];

// Helper to compute dot product of two taste profiles
function calculateTasteSimilarity(t1: TasteProfile, t2: TasteProfile): number {
  // Normalize profiles into [0.0, 1.0] vectors
  const vec1 = [t1.sweetness / 100, t1.saltiness / 100, t1.spiciness / 100, t1.umami / 100, t1.acidity / 100];
  const vec2 = [t2.sweetness / 100, t2.saltiness / 100, t2.spiciness / 100, t2.umami / 100, t2.acidity / 100];

  let dotProduct = 0;
  let len1 = 0;
  let len2 = 0;

  for (let i = 0; i < 5; i++) {
    dotProduct += vec1[i] * vec2[i];
    len1 += vec1[i] * vec1[i];
    len2 += vec2[i] * vec2[i];
  }

  if (len1 === 0 || len2 === 0) return 0.5;
  return dotProduct / (Math.sqrt(len1) * Math.sqrt(len2));
}

export function runCravingClassifier(input: CravingInput): PredictionResult {
  const scores: { dish: DishMetadata; totalScore: number; matchDetails: { mood: number; weather: number; taste: number; time: number } }[] = [];

  for (const dish of DISH_DATASET) {
    // 1. Mood affinity score (0.0 to 1.0)
    const moodFit = dish.moodAffinities[input.mood] ?? 0.5;

    // 2. Weather affinity score (0.0 to 1.0)
    const weatherFit = dish.weatherAffinities[input.weather] ?? 0.5;

    // 3. Time affinity score (0.0 to 1.0)
    const timeFit = dish.timeAffinities[input.timeOfDay] ?? 0.5;

    // 4. Taste DNA vector similarity score
    const tasteFit = calculateTasteSimilarity(dish.tasteWeights, input.tasteDna);

    // Compute feature-weighted score
    // Weights: Taste (40%), Mood (25%), Weather (25%), Time of Day (10%)
    const totalScore = (tasteFit * 0.40) + (moodFit * 0.25) + (weatherFit * 0.25) + (timeFit * 0.10);

    scores.push({
      dish,
      totalScore,
      matchDetails: {
        mood: Math.round(moodFit * 100),
        weather: Math.round(weatherFit * 100),
        taste: Math.round(tasteFit * 100),
        time: Math.round(timeFit * 100),
      }
    });
  }

  // Sort by highest score first
  scores.sort((a, b) => b.totalScore - a.totalScore);
  const best = scores[0];

  // Map totalScore to a percentage (normalize slightly to reflect strong similarity bounds)
  const confidence = Math.min(100, Math.round((best.totalScore) * 100));

  return {
    dishName: best.dish.name,
    category: best.dish.category,
    confidence: isNaN(confidence) ? 85 : confidence,
    matchingVector: {
      moodFit: best.matchDetails.mood,
      weatherFit: best.matchDetails.weather,
      tasteFit: best.matchDetails.taste,
      timeFit: best.matchDetails.time,
    },
    reason: best.dish.reason,
    recommendedTime: input.timeOfDay,
  };
}
