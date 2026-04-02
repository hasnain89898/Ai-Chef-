/**
 * API Helper for ChefAI Backend
 */

const API_BASE = '/api';

async function handleResponse(res: Response) {
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) {
      const error = new Error(data.error || `Request failed with status ${res.status}`);
      (error as any).status = res.status;
      (error as any).data = data;
      throw error;
    }
    return data;
  } else {
    const text = await res.text();
    if (!res.ok) {
      const error = new Error(`Request failed with status ${res.status}: ${text.substring(0, 100)}`);
      (error as any).status = res.status;
      throw error;
    }
    return text;
  }
}

const wrapFetch = async (fn: () => Promise<Response>) => {
  try {
    const res = await fn();
    return handleResponse(res);
  } catch (error: any) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new Error("Network error: Unable to reach the server. Please check your internet connection.");
    }
    throw error;
  }
};

export const api = {
  // User
  async getUser(userId: string) {
    return wrapFetch(() => fetch(`${API_BASE}/users/${userId}`));
  },
  async createUser(userData: { id: string, email: string, display_name: string, photo_url: string }) {
    return wrapFetch(() => fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    }));
  },
  async updateUser(userId: string, data: any) {
    return wrapFetch(() => fetch(`${API_BASE}/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }));
  },

  // Fridge
  async getFridge(userId: string) {
    return wrapFetch(() => fetch(`${API_BASE}/users/${userId}/fridge`));
  },
  async addFridgeItem(userId: string, item: { name: string, quantity: string, unit: string }) {
    return wrapFetch(() => fetch(`${API_BASE}/users/${userId}/fridge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    }));
  },
  async deleteFridgeItem(id: number) {
    return wrapFetch(() => fetch(`${API_BASE}/fridge/${id}`, { method: 'DELETE' }));
  },

  // Recipes
  async getRecipes(userId: string) {
    return wrapFetch(() => fetch(`${API_BASE}/users/${userId}/recipes`));
  },
  async saveRecipe(userId: string, recipe: any) {
    return wrapFetch(() => fetch(`${API_BASE}/users/${userId}/recipes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recipe),
    }));
  },
  async deleteRecipe(id: number) {
    return wrapFetch(() => fetch(`${API_BASE}/recipes/${id}`, { method: 'DELETE' }));
  },

  // Cravings
  async getCravings(userId: string) {
    return wrapFetch(() => fetch(`${API_BASE}/users/${userId}/cravings`));
  },
  async addCraving(userId: string, craving: any) {
    return wrapFetch(() => fetch(`${API_BASE}/users/${userId}/cravings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(craving),
    }));
  },

  // Chat
  async getChat(userId: string) {
    return wrapFetch(() => fetch(`${API_BASE}/users/${userId}/chat`));
  },
  async addChatMessage(userId: string, message: { role: string, content: string, imageUrl?: string }) {
    return wrapFetch(() => fetch(`${API_BASE}/users/${userId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    }));
  },

  // Meal Plan
  async getMealPlan(userId: string) {
    return wrapFetch(() => fetch(`${API_BASE}/users/${userId}/meal-plan`));
  },
  async addMealPlan(userId: string, plan: { recipe_id: number, date: string, meal_type: string }) {
    return wrapFetch(() => fetch(`${API_BASE}/users/${userId}/meal-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
    }));
  },
  async deleteMealPlan(id: number) {
    return wrapFetch(() => fetch(`${API_BASE}/meal-plan/${id}`, { method: 'DELETE' }));
  },

  // Grocery
  async getGrocery(userId: string) {
    return wrapFetch(() => fetch(`${API_BASE}/users/${userId}/grocery`));
  },
  async addGroceryItem(userId: string, item: { name: string, quantity: string, unit: string }) {
    return wrapFetch(() => fetch(`${API_BASE}/users/${userId}/grocery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    }));
  },
  async updateGroceryItem(id: number, isChecked: boolean) {
    return wrapFetch(() => fetch(`${API_BASE}/grocery/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_checked: isChecked }),
    }));
  },
  async deleteGroceryItem(id: number) {
    return wrapFetch(() => fetch(`${API_BASE}/grocery/${id}`, { method: 'DELETE' }));
  },

  // Subscription
  async getSubscription(userId: string) {
    return wrapFetch(() => fetch(`${API_BASE}/users/${userId}/subscription`));
  },
  async updateSubscription(userId: string, sub: { status: string, plan: string }) {
    return wrapFetch(() => fetch(`${API_BASE}/users/${userId}/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    }));
  },
  async incrementImageCount(userId: string) {
    return wrapFetch(() => fetch(`${API_BASE}/users/${userId}/increment-image-count`, {
      method: 'PATCH',
    }));
  },
  async createCheckoutSession(userId: string, plan: string) {
    return wrapFetch(() => fetch(`${API_BASE}/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, plan }),
    }));
  },
};
