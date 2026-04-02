/**
 * API Helper for ChefAI Backend
 */

const API_BASE = '/api';

export const api = {
  // User
  async getUser(userId: string) {
    const res = await fetch(`${API_BASE}/users/${userId}`);
    if (!res.ok) throw new Error('Failed to fetch user');
    return res.json();
  },
  async createUser(userData: { id: string, email: string, display_name: string, photo_url: string }) {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    if (!res.ok) throw new Error('Failed to create user');
    return res.json();
  },
  async updateUser(userId: string, data: any) {
    const res = await fetch(`${API_BASE}/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update user');
    return res.json();
  },

  // Fridge
  async getFridge(userId: string) {
    const res = await fetch(`${API_BASE}/users/${userId}/fridge`);
    return res.json();
  },
  async addFridgeItem(userId: string, item: { name: string, quantity: string, unit: string }) {
    const res = await fetch(`${API_BASE}/users/${userId}/fridge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return res.json();
  },
  async deleteFridgeItem(id: number) {
    const res = await fetch(`${API_BASE}/fridge/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Recipes
  async getRecipes(userId: string) {
    const res = await fetch(`${API_BASE}/users/${userId}/recipes`);
    return res.json();
  },
  async saveRecipe(userId: string, recipe: any) {
    const res = await fetch(`${API_BASE}/users/${userId}/recipes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recipe),
    });
    return res.json();
  },
  async deleteRecipe(id: number) {
    const res = await fetch(`${API_BASE}/recipes/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Cravings
  async getCravings(userId: string) {
    const res = await fetch(`${API_BASE}/users/${userId}/cravings`);
    return res.json();
  },
  async addCraving(userId: string, craving: any) {
    const res = await fetch(`${API_BASE}/users/${userId}/cravings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(craving),
    });
    return res.json();
  },

  // Chat
  async getChat(userId: string) {
    const res = await fetch(`${API_BASE}/users/${userId}/chat`);
    return res.json();
  },
  async addChatMessage(userId: string, message: { role: string, content: string }) {
    const res = await fetch(`${API_BASE}/users/${userId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
    return res.json();
  },

  // Meal Plan
  async getMealPlan(userId: string) {
    const res = await fetch(`${API_BASE}/users/${userId}/meal-plan`);
    return res.json();
  },
  async addMealPlan(userId: string, plan: { recipe_id: number, date: string, meal_type: string }) {
    const res = await fetch(`${API_BASE}/users/:userId/meal-plan`.replace(':userId', userId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(plan),
    });
    return res.json();
  },
  async deleteMealPlan(id: number) {
    const res = await fetch(`${API_BASE}/meal-plan/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Grocery
  async getGrocery(userId: string) {
    const res = await fetch(`${API_BASE}/users/${userId}/grocery`);
    return res.json();
  },
  async addGroceryItem(userId: string, item: { name: string, quantity: string, unit: string }) {
    const res = await fetch(`${API_BASE}/users/${userId}/grocery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return res.json();
  },
  async updateGroceryItem(id: number, isChecked: boolean) {
    const res = await fetch(`${API_BASE}/grocery/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_checked: isChecked }),
    });
    return res.json();
  },
  async deleteGroceryItem(id: number) {
    const res = await fetch(`${API_BASE}/grocery/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // Subscription
  async getSubscription(userId: string) {
    const res = await fetch(`${API_BASE}/users/${userId}/subscription`);
    return res.json();
  },
  async updateSubscription(userId: string, sub: { status: string, plan: string }) {
    const res = await fetch(`${API_BASE}/users/${userId}/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub),
    });
    return res.json();
  },
  async incrementImageCount(userId: string) {
    const res = await fetch(`${API_BASE}/users/${userId}/increment-image-count`, {
      method: 'PATCH',
    });
    return res.json();
  },
};
