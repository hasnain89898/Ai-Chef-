/**
 * API Helper for ChefAI Backend
 */

const API_BASE = '/api';

async function handleResponse(res: Response) {
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `Request failed with status ${res.status}`);
    }
    return data;
  } else {
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Request failed with status ${res.status}: ${text.substring(0, 100)}`);
    }
    return text;
  }
}

export const api = {
  // User
  async getUser(userId: string) {
    const res = await fetch(`${API_BASE}/users/${userId}`);
    return handleResponse(res);
  },
  async createUser(userData: { id: string, email: string, display_name: string, photo_url: string }) {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    return handleResponse(res);
  },
  async updateUser(userId: string, data: any) {
    const res = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  // Fridge
  async getFridge(userId: string) {
    const res = await fetch(`${API_BASE}/users/${userId}/fridge`);
    return handleResponse(res);
  },
  async addFridgeItem(userId: string, item: { name: string, quantity: string, unit: string }) {
    const res = await fetch(`${API_BASE}/users/${userId}/fridge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return handleResponse(res);
  },
  async deleteFridgeItem(id: number) {
    const res = await fetch(`${API_BASE}/fridge/${id}`, { method: 'DELETE' });
    return handleResponse(res);
  },

  // Recipes
  async getRecipes(userId: string) {
    const res = await fetch(`${API_BASE}/users/${userId}/recipes`);
    return handleResponse(res);
  },
  async saveRecipe(userId: string, recipe: any) {
    const res = await fetch(`${API_BASE}/users/${userId}/recipes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recipe),
    });
    return handleResponse(res);
  },
  async deleteRecipe(id: number) {
    const res = await fetch(`${API_BASE}/recipes/${id}`, { method: 'DELETE' });
    return handleResponse(res);
  },

  // Cravings
  async getCravings(userId: string) {
    const res = await fetch(`${API_BASE}/users/${userId}/cravings`);
    return handleResponse(res);
  },
  async addCraving(userId: string, craving: any) {
    const res = await fetch(`${API_BASE}/users/${userId}/cravings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(craving),
    });
    return handleResponse(res);
  },

  // Chat
  async getChat(userId: string) {
    const res = await fetch(`${API_BASE}/users/${userId}/chat`);
    return handleResponse(res);
  },
  async addChatMessage(userId: string, message: { role: string, content: string }) {
    const res = await fetch(`${API_BASE}/users/${userId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    return handleResponse(res);
  },

  // Meal Plan
  async getMealPlan(userId: string) {
    const res = await fetch(`${API_BASE}/users/${userId}/meal-plan`);
    return handleResponse(res);
  },
  async addMealPlan(userId: string, plan: { recipe_id: number, date: string, meal_type: string }) {
    const res = await fetch(`${API_BASE}/users/${userId}/meal-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
    });
    return handleResponse(res);
  },
  async deleteMealPlan(id: number) {
    const res = await fetch(`${API_BASE}/meal-plan/${id}`, { method: 'DELETE' });
    return handleResponse(res);
  },

  // Grocery
  async getGrocery(userId: string) {
    const res = await fetch(`${API_BASE}/users/${userId}/grocery`);
    return handleResponse(res);
  },
  async addGroceryItem(userId: string, item: { name: string, quantity: string, unit: string }) {
    const res = await fetch(`${API_BASE}/users/${userId}/grocery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return handleResponse(res);
  },
  async updateGroceryItem(id: number, isChecked: boolean) {
    const res = await fetch(`${API_BASE}/grocery/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_checked: isChecked }),
    });
    return handleResponse(res);
  },
  async deleteGroceryItem(id: number) {
    const res = await fetch(`${API_BASE}/grocery/${id}`, { method: 'DELETE' });
    return handleResponse(res);
  },

  // Subscription
  async getSubscription(userId: string) {
    const res = await fetch(`${API_BASE}/users/${userId}/subscription`);
    return handleResponse(res);
  },
  async updateSubscription(userId: string, sub: { status: string, plan: string }) {
    const res = await fetch(`${API_BASE}/users/${userId}/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    });
    return handleResponse(res);
  },
  async incrementImageCount(userId: string) {
    const res = await fetch(`${API_BASE}/users/${userId}/increment-image-count`, {
      method: 'PATCH',
    });
    return handleResponse(res);
  },
};
