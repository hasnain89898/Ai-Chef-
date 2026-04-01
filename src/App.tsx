/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChefHat, 
  Refrigerator, 
  Utensils, 
  Brain, 
  Plus, 
  Trash2, 
  Search, 
  LogOut, 
  LogIn, 
  User as UserIcon, 
  History, 
  Sparkles, 
  CloudRain, 
  CloudSun, 
  Wind, 
  Sun, 
  Thermometer, 
  Clock, 
  Zap, 
  ChevronRight, 
  Menu, 
  X,
  ArrowRight,
  Github,
  Twitter,
  Instagram,
  MessageSquare,
  Calendar,
  ShoppingCart,
  CreditCard,
  Mic,
  MicOff,
  Send,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer 
} from 'recharts';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  FirebaseUser, 
  handleFirestoreError, 
  OperationType,
  testConnection
} from './lib/firebase';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc,
  deleteDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { generateRecipe, predictCraving, analyzeTasteDNA, chatWithChef, searchRecipeByName, Recipe } from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger', size?: 'sm' | 'md' | 'lg' }>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-orange-600 text-white hover:bg-orange-700 shadow-sm',
      secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700',
      ghost: 'bg-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50',
      danger: 'bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white border border-red-600/20',
    };
    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2',
      lg: 'px-6 py-3 text-lg font-medium',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

const Card = ({ children, className, delay = 0 }: { children: React.ReactNode, className?: string, delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
    className={cn('bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 backdrop-blur-xl', className)}
  >
    {children}
  </motion.div>
);

const Badge = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-600/20 text-orange-500 border border-orange-600/30', className)}>
    {children}
  </span>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'fridge' | 'recipes' | 'dna' | 'chat' | 'meal-plan' | 'grocery' | 'subscription'>('dashboard');
  const [fridgeItems, setFridgeItems] = useState<any[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<any[]>([]);
  const [cravings, setCravings] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // New State
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [mealPlans, setMealPlans] = useState<any[]>([]);
  const [groceryList, setGroceryList] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<{ status: 'free' | 'pro'; plan: string } | null>(null);

  useEffect(() => {
    testConnection();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listen to user profile
    const userDoc = doc(db, 'users', user.uid);
    const unsubProfile = onSnapshot(userDoc, (doc) => {
      if (doc.exists()) {
        setUserProfile(doc.data());
      } else {
        // Initialize profile
        const initialProfile = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          preferredCuisine: 'Mediterranean',
          tasteDNA: { sweetness: 50, saltiness: 50, spiciness: 50, umami: 50, acidity: 50 },
          imageUploadCount: 0,
          lastImageUploadAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        };
        setDoc(userDoc, initialProfile).catch(e => handleFirestoreError(e, OperationType.WRITE, `users/${user.uid}`));
      }
    }, (e) => handleFirestoreError(e, OperationType.GET, `users/${user.uid}`));

    // Listen to fridge items
    const fridgeRef = collection(db, 'users', user.uid, 'fridge');
    const unsubFridge = onSnapshot(query(fridgeRef, orderBy('addedAt', 'desc')), (snap) => {
      setFridgeItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (e) => handleFirestoreError(e, OperationType.GET, `users/${user.uid}/fridge`));

    // Listen to recipes
    const recipesRef = collection(db, 'users', user.uid, 'recipes');
    const unsubRecipes = onSnapshot(query(recipesRef, orderBy('generatedAt', 'desc')), (snap) => {
      setSavedRecipes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (e) => handleFirestoreError(e, OperationType.GET, `users/${user.uid}/recipes`));

    // Listen to cravings
    const cravingsRef = collection(db, 'users', user.uid, 'cravings');
    const unsubCravings = onSnapshot(query(cravingsRef, orderBy('timestamp', 'desc'), limit(5)), (snap) => {
      setCravings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (e) => handleFirestoreError(e, OperationType.GET, `users/${user.uid}/cravings`));

    // Listen to chat
    const chatRef = collection(db, 'users', user.uid, 'chat');
    const unsubChat = onSnapshot(query(chatRef, orderBy('timestamp', 'asc'), limit(50)), (snap) => {
      setChatMessages(snap.docs.map(d => d.data() as any));
    }, (e) => handleFirestoreError(e, OperationType.GET, `users/${user.uid}/chat`));

    // Listen to subscription
    const subRef = doc(db, 'users', user.uid, 'subscription', 'status');
    const unsubSub = onSnapshot(subRef, (snap) => {
      if (snap.exists()) {
        setSubscription(snap.data() as any);
      } else {
        setSubscription({ status: 'free', plan: 'none' });
      }
    }, (e) => handleFirestoreError(e, OperationType.GET, `users/${user.uid}/subscription`));

    // Listen to meal plan
    const mealRef = collection(db, 'users', user.uid, 'mealPlan');
    const unsubMeal = onSnapshot(query(mealRef, orderBy('date', 'asc')), (snap) => {
      setMealPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (e) => handleFirestoreError(e, OperationType.GET, `users/${user.uid}/mealPlan`));

    // Listen to grocery list
    const groceryRef = collection(db, 'users', user.uid, 'groceryList');
    const unsubGrocery = onSnapshot(query(groceryRef, orderBy('addedAt', 'desc')), (snap) => {
      setGroceryList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (e) => handleFirestoreError(e, OperationType.GET, `users/${user.uid}/groceryList`));

    return () => {
      unsubProfile();
      unsubFridge();
      unsubRecipes();
      unsubCravings();
      unsubChat();
      unsubSub();
      unsubMeal();
      unsubGrocery();
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed', error);
    }
  };

  const handleLogout = () => auth.signOut();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <ChefHat className="w-12 h-12 text-orange-600" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-orange-600/30">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat className="w-8 h-8 text-orange-600" />
            <span className="text-xl font-bold tracking-tighter">CHEF<span className="text-orange-600">AI</span></span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-1">
            <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<Sparkles className="w-4 h-4" />} label="Dashboard" />
            <NavButton active={activeTab === 'fridge'} onClick={() => setActiveTab('fridge')} icon={<Refrigerator className="w-4 h-4" />} label="Fridge" />
            <NavButton active={activeTab === 'recipes'} onClick={() => setActiveTab('recipes')} icon={<Utensils className="w-4 h-4" />} label="Recipes" />
            <NavButton active={activeTab === 'dna'} onClick={() => setActiveTab('dna')} icon={<Brain className="w-4 h-4" />} label="Taste DNA" />
            <NavButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageSquare className="w-4 h-4" />} label="Chef Chat" />
            <NavButton active={activeTab === 'meal-plan'} onClick={() => setActiveTab('meal-plan')} icon={<Calendar className="w-4 h-4" />} label="Meal Plan" />
            <NavButton active={activeTab === 'grocery'} onClick={() => setActiveTab('grocery')} icon={<ShoppingCart className="w-4 h-4" />} label="Grocery" />
            <NavButton active={activeTab === 'subscription'} onClick={() => setActiveTab('subscription')} icon={<CreditCard className="w-4 h-4" />} label={subscription?.status === 'pro' ? 'Pro Active' : 'Go Pro'} />
          </div>

          <div className="flex items-center gap-4">
            {subscription?.status === 'pro' && (
              <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-orange-600/10 border border-orange-600/20 rounded-lg">
                <Sparkles className="w-3 h-3 text-orange-500" />
                <span className="text-[10px] font-bold text-orange-500 uppercase tracking-tighter">Pro</span>
              </div>
            )}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-zinc-900 rounded-full border border-zinc-800">
              <img src={user.photoURL || ''} alt="" className="w-6 h-6 rounded-full" />
              <span className="text-xs font-medium">{user.displayName}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden sm:inline-flex">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
            <button className="md:hidden p-2 text-zinc-400" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              {isMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-black pt-20 px-4 md:hidden"
          >
            <div className="flex flex-col gap-2">
              <MobileNavButton active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsMenuOpen(false); }} icon={<Sparkles />} label="Dashboard" />
              <MobileNavButton active={activeTab === 'fridge'} onClick={() => { setActiveTab('fridge'); setIsMenuOpen(false); }} icon={<Refrigerator />} label="Fridge" />
              <MobileNavButton active={activeTab === 'recipes'} onClick={() => { setActiveTab('recipes'); setIsMenuOpen(false); }} icon={<Utensils />} label="Recipes" />
              <MobileNavButton active={activeTab === 'dna'} onClick={() => { setActiveTab('dna'); setIsMenuOpen(false); }} icon={<Brain />} label="Taste DNA" />
              <MobileNavButton active={activeTab === 'chat'} onClick={() => { setActiveTab('chat'); setIsMenuOpen(false); }} icon={<MessageSquare />} label="Chef Chat" />
              <MobileNavButton active={activeTab === 'meal-plan'} onClick={() => { setActiveTab('meal-plan'); setIsMenuOpen(false); }} icon={<Calendar />} label="Meal Plan" />
              <MobileNavButton active={activeTab === 'grocery'} onClick={() => { setActiveTab('grocery'); setIsMenuOpen(false); }} icon={<ShoppingCart />} label="Grocery" />
              <MobileNavButton active={activeTab === 'subscription'} onClick={() => { setActiveTab('subscription'); setIsMenuOpen(false); }} icon={<CreditCard />} label="Pro" />
              <hr className="border-zinc-800 my-4" />
              <Button variant="ghost" onClick={handleLogout} className="justify-start">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 pt-24 pb-12">
        {activeTab === 'dashboard' && (
          <Dashboard 
            user={user} 
            fridgeItems={fridgeItems} 
            cravings={cravings} 
            userProfile={userProfile} 
            onNavigate={(tab) => setActiveTab(tab)}
            subscription={subscription}
          />
        )}
        {activeTab === 'fridge' && <FridgeManager user={user} items={fridgeItems} />}
        {activeTab === 'recipes' && <RecipeExplorer user={user} fridgeItems={fridgeItems} savedRecipes={savedRecipes} userProfile={userProfile} />}
        {activeTab === 'dna' && <TasteDNA user={user} profile={userProfile} />}
        {activeTab === 'chat' && <ChefChat user={user} messages={chatMessages} fridgeItems={fridgeItems} savedRecipes={savedRecipes} profile={userProfile} onUpgrade={() => setActiveTab('subscription')} />}
        {activeTab === 'meal-plan' && <MealPlanner user={user} plans={mealPlans} savedRecipes={savedRecipes} isPro={subscription?.status === 'pro'} onUpgrade={() => setActiveTab('subscription')} />}
        {activeTab === 'grocery' && <GroceryList user={user} items={groceryList} isPro={subscription?.status === 'pro'} onUpgrade={() => setActiveTab('subscription')} />}
        {activeTab === 'subscription' && <SubscriptionPlans user={user} currentSub={subscription} />}
      </main>
    </div>
  );
}

// --- Sub-components ---

function LandingPage({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-orange-600/30 overflow-hidden">
      {/* Hero Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-600/10 via-transparent to-black" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-zinc-600/10 rounded-full blur-[120px]" />
      </div>

      <nav className="relative z-10 max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="w-8 h-8 text-orange-600" />
          <span className="text-2xl font-bold tracking-tighter">CHEF<span className="text-orange-600">AI</span></span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
          <a href="#" className="hover:text-white transition-colors">Features</a>
          <a href="#" className="hover:text-white transition-colors">How it works</a>
          <a href="#" className="hover:text-white transition-colors">Community</a>
        </div>
        <Button onClick={onLogin} className="rounded-full px-8">
          Get Started
        </Button>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Badge className="mb-6">AI-Powered Culinary Intelligence</Badge>
            <h1 className="text-6xl md:text-8xl font-bold tracking-tight leading-[0.9] mb-8">
              Your Personal <br />
              <span className="text-orange-600">Digital Chef.</span>
            </h1>
            <p className="text-xl text-zinc-400 max-w-lg mb-10 leading-relaxed">
              ChefAI manages your kitchen, predicts your cravings, and crafts professional recipes tailored to your unique Taste DNA.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" onClick={onLogin} className="rounded-full px-10">
                Start Cooking <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button size="lg" variant="secondary" className="rounded-full px-10">
                View Demo
              </Button>
            </div>

            <div className="mt-16 flex items-center gap-8">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map(i => (
                  <img key={i} src={`https://picsum.photos/seed/user${i}/100/100`} className="w-10 h-10 rounded-full border-2 border-black" alt="" />
                ))}
              </div>
              <p className="text-sm text-zinc-500">
                <span className="text-white font-bold">10k+</span> chefs already using ChefAI
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1 }}
            className="relative"
          >
            <div className="relative z-10 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-4 backdrop-blur-xl shadow-2xl">
              <img 
                src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&q=80&w=1000" 
                className="rounded-2xl w-full aspect-[4/5] object-cover" 
                alt="Chef cooking" 
              />
              <div className="absolute -bottom-6 -left-6 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-xl max-w-[240px]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-orange-600/20 rounded-lg">
                    <Brain className="w-5 h-5 text-orange-500" />
                  </div>
                  <span className="text-sm font-bold">AI Prediction</span>
                </div>
                <p className="text-xs text-zinc-400 mb-2">Based on your mood and the rainy weather, you might be craving:</p>
                <p className="text-lg font-bold text-orange-500">Creamy Mushroom Risotto</p>
              </div>
            </div>
            {/* Decorative elements */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-600/30 rounded-full blur-3xl" />
          </motion.div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-zinc-900 py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-orange-600" />
            <span className="text-xl font-bold tracking-tighter">CHEF<span className="text-orange-600">AI</span></span>
          </div>
          <div className="flex gap-6 text-zinc-500">
            <a href="#" className="hover:text-white"><Twitter className="w-5 h-5" /></a>
            <a href="#" className="hover:text-white"><Instagram className="w-5 h-5" /></a>
            <a href="#" className="hover:text-white"><Github className="w-5 h-5" /></a>
          </div>
          <p className="text-sm text-zinc-600">© 2026 ChefAI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200',
        active ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function MobileNavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-4 px-4 py-4 rounded-2xl text-lg font-medium transition-all duration-200',
        active ? 'bg-orange-600 text-white' : 'text-zinc-400 hover:bg-zinc-900'
      )}
    >
      {React.cloneElement(icon as React.ReactElement<any>, { className: 'w-6 h-6' })}
      {label}
    </button>
  );
}

function Dashboard({ user, fridgeItems, cravings, userProfile, onNavigate, subscription }: { user: FirebaseUser, fridgeItems: any[], cravings: any[], userProfile: any, onNavigate: (tab: any) => void, subscription: any }) {
  const [prediction, setPrediction] = useState<any>(null);
  const [isPredicting, setIsPredicting] = useState(false);

  const handlePredict = async () => {
    setIsPredicting(true);
    try {
      const mood = "Happy"; 
      const weather = "Sunny"; 
      const dish = await predictCraving(mood, weather);
      
      const cravingData = {
        mood,
        weather,
        predictedDish: dish,
        confidence: Math.floor(Math.random() * 20) + 75,
        timestamp: serverTimestamp(),
      };

      await addDoc(collection(db, 'users', user.uid, 'cravings'), cravingData);
      setPrediction(cravingData);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `users/${user.uid}/cravings`);
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Welcome back, {user.displayName?.split(' ')[0]}</h2>
          <p className="text-zinc-500">Your personal culinary dashboard is ready.</p>
        </div>
        <div className="flex items-center gap-4 text-sm text-zinc-400">
          <div className="flex items-center gap-2">
            <Sun className="w-4 h-4 text-yellow-500" />
            <span>72°F Sunny</span>
          </div>
          <div className="w-px h-4 bg-zinc-800" />
          <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-6">
        {/* AI Prediction - Large Bento Item */}
        <Card className="md:col-span-4 lg:col-span-4 relative overflow-hidden group min-h-[320px] flex flex-col justify-center">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <Brain className="w-48 h-48 text-orange-600" />
          </div>
          <div className="relative z-10">
            <Badge className="mb-4">AI Prediction Engine</Badge>
            <h3 className="text-3xl font-bold mb-4">What's on the menu?</h3>
            <p className="text-zinc-400 mb-8 max-w-md text-lg">Our neural network crafts suggestions based on your mood, local weather, and Taste DNA.</p>
            
            {prediction ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-orange-600/10 border border-orange-600/20 rounded-2xl p-6 mb-2 max-w-md"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-orange-500">Chef's Recommendation</span>
                  <span className="text-[10px] font-medium text-zinc-500">{prediction.confidence}% Match</span>
                </div>
                <p className="text-3xl font-bold text-white mb-4">{prediction.predictedDish}</p>
                <Button size="sm" onClick={() => onNavigate('recipes')} className="rounded-full">
                  Get Recipe <ChevronRight className="ml-1 w-4 h-4" />
                </Button>
              </motion.div>
            ) : (
              <Button onClick={handlePredict} disabled={isPredicting} size="lg" className="rounded-full px-8">
                {isPredicting ? 'Analyzing...' : 'Predict My Craving'}
                <Sparkles className="ml-2 w-5 h-5" />
              </Button>
            )}
          </div>
        </Card>

        {/* Fridge Status - Medium Bento Item */}
        <Card className="md:col-span-2 lg:col-span-2 flex flex-col justify-between overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Refrigerator className="w-24 h-24" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-6">
              <div className="p-3 bg-zinc-800 rounded-xl">
                <Refrigerator className="w-6 h-6 text-orange-500" />
              </div>
              <Badge>{fridgeItems.length} Items</Badge>
            </div>
            <h3 className="text-xl font-bold mb-2">Smart Fridge</h3>
            <p className="text-zinc-500 text-sm mb-6">Your inventory is {fridgeItems.length > 10 ? 'well-stocked' : 'running low'}.</p>
          </div>
          <div className="space-y-3">
            {fridgeItems.slice(0, 3).map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm p-2 bg-zinc-950/50 rounded-lg border border-zinc-800/50">
                <span className="text-zinc-400">{item.name}</span>
                <span className="text-zinc-600 font-mono text-xs">{item.quantity}{item.unit}</span>
              </div>
            ))}
            <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => onNavigate('fridge')}>
              Inventory Details
            </Button>
          </div>
        </Card>

        {/* Taste DNA - Medium Bento Item */}
        <Card className="md:col-span-3 lg:col-span-3">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-orange-500" />
              <h3 className="text-xl font-bold">Taste DNA</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('dna')}>Full Profile</Button>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                { subject: 'Sweet', A: userProfile?.tasteDNA?.sweetness || 50 },
                { subject: 'Salt', A: userProfile?.tasteDNA?.saltiness || 50 },
                { subject: 'Spice', A: userProfile?.tasteDNA?.spiciness || 50 },
                { subject: 'Umami', A: userProfile?.tasteDNA?.umami || 50 },
                { subject: 'Acid', A: userProfile?.tasteDNA?.acidity || 50 },
              ]}>
                <PolarGrid stroke="#27272a" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#71717a', fontSize: 10, fontWeight: 600 }} />
                <Radar name="User" dataKey="A" stroke="#ea580c" fill="#ea580c" fillOpacity={0.6} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Recent History - Medium Bento Item */}
        <Card className="md:col-span-3 lg:col-span-3">
          <div className="flex items-center gap-2 mb-6">
            <History className="w-5 h-5 text-orange-500" />
            <h3 className="text-xl font-bold">Recent Cravings</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {cravings.length > 0 ? cravings.slice(0, 4).map((craving, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-zinc-950/50 rounded-xl border border-zinc-800/50">
                <div className="p-2 bg-zinc-900 rounded-lg">
                  {craving.weather === 'Sunny' ? <Sun className="w-4 h-4 text-yellow-500" /> : <CloudRain className="w-4 h-4 text-blue-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate">{craving.predictedDish}</p>
                  <p className="text-[9px] text-zinc-600 uppercase tracking-wider">{new Date(craving.timestamp?.toDate()).toLocaleDateString()}</p>
                </div>
              </div>
            )) : (
              <div className="col-span-2 text-center py-12 text-zinc-600">
                <p>No history yet</p>
              </div>
            )}
          </div>
        </Card>

        {/* Subscription Status - Small Bento Item */}
        <Card className={cn(
          "md:col-span-2 lg:col-span-2 flex flex-col justify-between border-2",
          subscription?.status === 'pro' ? "border-orange-600/20 bg-orange-600/5" : "border-zinc-800"
        )}>
          <div>
            <h3 className="text-lg font-bold mb-1">Account Tier</h3>
            <p className="text-zinc-500 text-xs mb-4">Current plan status</p>
            <div className="flex items-center gap-2 mb-4">
              <div className={cn(
                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                subscription?.status === 'pro' ? "bg-orange-600 text-white" : "bg-zinc-800 text-zinc-400"
              )}>
                {subscription?.status === 'pro' ? 'Pro Member' : 'Free Tier'}
              </div>
            </div>
          </div>
          <Button 
            variant={subscription?.status === 'pro' ? 'ghost' : 'primary'} 
            size="sm" 
            className="w-full"
            onClick={() => onNavigate('subscription')}
          >
            {subscription?.status === 'pro' ? 'Manage Subscription' : 'Upgrade to Pro'}
          </Button>
        </Card>

        {/* Quick Actions - Small Bento Item */}
        <Card className="md:col-span-2 lg:col-span-2 flex flex-col justify-between">
          <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onNavigate('chat')} className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 hover:border-orange-600/50 transition-colors flex flex-col items-center gap-2">
              <MessageSquare className="w-4 h-4 text-orange-500" />
              <span className="text-[10px] font-bold uppercase">Chat</span>
            </button>
            <button onClick={() => onNavigate('recipes')} className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 hover:border-orange-600/50 transition-colors flex flex-col items-center gap-2">
              <Search className="w-4 h-4 text-orange-500" />
              <span className="text-[10px] font-bold uppercase">Search</span>
            </button>
          </div>
        </Card>

        {/* Stats - Small Bento Item */}
        <Card className="md:col-span-2 lg:col-span-2 flex flex-col justify-center items-center text-center">
          <div className="p-4 bg-orange-600/10 rounded-full mb-4">
            <Utensils className="w-8 h-8 text-orange-500" />
          </div>
          <p className="text-3xl font-bold">12</p>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Recipes Crafted</p>
        </Card>
      </div>
    </div>
  );
}

function FridgeManager({ user, items }: { user: FirebaseUser, items: any[] }) {
  const [newItem, setNewItem] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('pcs');

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;

    try {
      await addDoc(collection(db, 'users', user.uid, 'fridge'), {
        name: newItem,
        quantity: parseFloat(quantity),
        unit,
        addedAt: serverTimestamp(),
      });
      setNewItem('');
      setQuantity('1');
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `users/${user.uid}/fridge`);
    }
  };

  const handleDeleteItem = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'fridge', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `users/${user.uid}/fridge/${id}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header>
        <h2 className="text-4xl font-bold tracking-tight">Fridge Manager</h2>
        <p className="text-zinc-500">Keep track of your ingredients to get better recipe suggestions.</p>
      </header>

      <Card>
        <form onSubmit={handleAddItem} className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Ingredient Name</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input 
                type="text" 
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="e.g. Fresh Salmon" 
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:border-orange-600 transition-colors"
              />
            </div>
          </div>
          <div className="w-24">
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Qty</label>
            <input 
              type="number" 
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 focus:outline-none focus:border-orange-600 transition-colors"
            />
          </div>
          <div className="w-32">
            <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Unit</label>
            <select 
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-4 focus:outline-none focus:border-orange-600 transition-colors appearance-none"
            >
              <option>pcs</option>
              <option>kg</option>
              <option>g</option>
              <option>ml</option>
              <option>oz</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button type="submit" className="h-11">
              <Plus className="w-5 h-5" />
            </Button>
          </div>
        </form>
      </Card>

      <div className="grid gap-3">
        <AnimatePresence mode="popLayout">
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center justify-between p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center">
                  <Utensils className="w-5 h-5 text-zinc-500" />
                </div>
                <div>
                  <p className="font-bold">{item.name}</p>
                  <p className="text-xs text-zinc-500">Added {new Date(item.addedAt?.toDate()).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-sm font-medium text-zinc-400">{item.quantity} {item.unit}</span>
                <button 
                  onClick={() => handleDeleteItem(item.id)}
                  className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {items.length === 0 && (
          <div className="text-center py-20 border-2 border-dashed border-zinc-900 rounded-3xl">
            <Refrigerator className="w-16 h-16 mx-auto mb-4 text-zinc-800" />
            <p className="text-zinc-600">Your fridge is empty. Add some ingredients!</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RecipeExplorer({ user, fridgeItems, savedRecipes, userProfile }: { user: FirebaseUser, fridgeItems: any[], savedRecipes: any[], userProfile: any }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentRecipe, setCurrentRecipe] = useState<Recipe | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [isVoiceGuided, setIsVoiceGuided] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleGenerate = async () => {
    if (fridgeItems.length === 0) {
      alert('Add some items to your fridge first!');
      return;
    }
    setIsGenerating(true);
    try {
      const ingredients = fridgeItems.map(i => i.name);
      const recipe = await generateRecipe(ingredients, userProfile?.preferredCuisine);
      setCurrentRecipe(recipe);
      setActiveStep(null);
      setIsVoiceGuided(false);
    } catch (e) {
      console.error('Recipe generation failed', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsGenerating(true);
    try {
      const recipe = await searchRecipeByName(searchQuery);
      setCurrentRecipe(recipe);
      setActiveStep(null);
      setIsVoiceGuided(false);
      setSearchQuery('');
    } catch (e) {
      console.error('Recipe search failed', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!currentRecipe) return;
    try {
      await addDoc(collection(db, 'users', user.uid, 'recipes'), {
        ...currentRecipe,
        generatedAt: serverTimestamp(),
      });
      setCurrentRecipe(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, `users/${user.uid}/recipes`);
    }
  };

  const addToGroceryList = async (ingredients: string[]) => {
    try {
      const ref = collection(db, 'users', user.uid, 'groceryList');
      for (const ing of ingredients) {
        await addDoc(ref, {
          name: ing,
          checked: false,
          addedAt: serverTimestamp()
        });
      }
      alert('Ingredients added to your grocery list!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'groceryList');
    }
  };

  const speakStep = (index: number) => {
    if (!currentRecipe) return;
    const step = currentRecipe.instructions[index];
    const utterance = new SpeechSynthesisUtterance(`Step ${index + 1}: ${step}`);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setActiveStep(index);
  };

  const toggleVoiceGuided = () => {
    if (isVoiceGuided) {
      setIsVoiceGuided(false);
      window.speechSynthesis.cancel();
    } else {
      setIsVoiceGuided(true);
      speakStep(0);
    }
  };

  useEffect(() => {
    if (!isVoiceGuided || !currentRecipe) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const command = event.results[event.results.length - 1][0].transcript.toLowerCase();
      if (command.includes('next')) {
        const next = (activeStep ?? -1) + 1;
        if (next < currentRecipe.instructions.length) speakStep(next);
      } else if (command.includes('repeat')) {
        if (activeStep !== null) speakStep(activeStep);
      } else if (command.includes('previous') || command.includes('back')) {
        const prev = (activeStep ?? 0) - 1;
        if (prev >= 0) speakStep(prev);
      }
    };

    recognition.start();
    return () => recognition.stop();
  }, [isVoiceGuided, currentRecipe, activeStep]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Recipe Explorer</h2>
          <p className="text-zinc-500">Search for any dish or craft recipes from your fridge.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <form onSubmit={handleSearch} className="relative flex-1 sm:w-80 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search or paste a recipe..." 
                className="w-full bg-zinc-950 border border-zinc-800 rounded-full py-2 pl-10 pr-10 focus:outline-none focus:border-orange-600 transition-colors text-sm"
              />
              <button
                type="button"
                onClick={() => {
                  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                  if (!SpeechRecognition) return;
                  const recognition = new SpeechRecognition();
                  recognition.lang = 'en-US';
                  recognition.onresult = (e: any) => setSearchQuery(e.results[0][0].transcript);
                  recognition.start();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-orange-500 transition-colors"
              >
                <Mic className="w-4 h-4" />
              </button>
            </div>
            <Button type="submit" size="sm" className="rounded-full px-4">Search</Button>
          </form>
          <Button onClick={handleGenerate} disabled={isGenerating} size="lg" className="rounded-full whitespace-nowrap">
            {isGenerating ? 'Crafting...' : 'Craft from Fridge'}
            <Zap className="ml-2 w-5 h-5 fill-current" />
          </Button>
        </div>
      </header>

      <AnimatePresence>
        {currentRecipe && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-zinc-900 border border-orange-600/30 rounded-3xl overflow-hidden shadow-2xl shadow-orange-600/10"
          >
            <div className="p-8 md:p-12">
              <div className="flex flex-wrap items-start justify-between gap-6 mb-8">
                <div className="flex-1">
                  <Badge className="mb-4">AI Analysis & Generation</Badge>
                  <h3 className="text-4xl font-bold mb-4">{currentRecipe.title}</h3>
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-orange-500">Benefits & Profile</p>
                    <p className="text-zinc-400 text-lg max-w-2xl leading-relaxed">{currentRecipe.description}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <Button onClick={handleSave} className="w-full">Save to Collection</Button>
                  <Button variant="secondary" onClick={() => addToGroceryList(currentRecipe.ingredients)} className="w-full">
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Add to Grocery List
                  </Button>
                  <Button variant="ghost" onClick={() => setCurrentRecipe(null)} className="w-full">Discard</Button>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-12">
                <div className="md:col-span-1 space-y-8">
                  <div className="flex gap-4">
                    <div className="flex-1 p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                      <Clock className="w-5 h-5 text-orange-500 mb-2" />
                      <p className="text-xs text-zinc-500 uppercase font-bold">Time</p>
                      <p className="font-bold">{currentRecipe.time}</p>
                    </div>
                    <div className="flex-1 p-4 bg-zinc-950 rounded-2xl border border-zinc-800">
                      <Zap className="w-5 h-5 text-orange-500 mb-2" />
                      <p className="text-xs text-zinc-500 uppercase font-bold">Difficulty</p>
                      <p className="font-bold">{currentRecipe.difficulty}</p>
                    </div>
                  </div>

                  {currentRecipe.nutrition && (
                    <div className="p-6 bg-zinc-950 rounded-2xl border border-zinc-800">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">Nutritional Info</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase">Calories</p>
                          <p className="font-bold text-orange-500">{currentRecipe.nutrition.calories}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase">Protein</p>
                          <p className="font-bold">{currentRecipe.nutrition.protein}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase">Carbs</p>
                          <p className="font-bold">{currentRecipe.nutrition.carbs}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-zinc-500 uppercase">Fat</p>
                          <p className="font-bold">{currentRecipe.nutrition.fat}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500 mb-4">Ingredients</h4>
                    <ul className="space-y-3">
                      {currentRecipe.ingredients.map((ing, i) => (
                        <li key={i} className="flex items-center gap-3 text-zinc-300">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-600" />
                          {ing}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Instructions</h4>
                    <div className="flex items-center gap-4">
                      {isVoiceGuided && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-orange-600/10 rounded-full animate-pulse">
                          <div className="w-2 h-2 bg-orange-500 rounded-full" />
                          <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">Listening: "Next", "Repeat", "Back"</span>
                        </div>
                      )}
                      <Button 
                        variant={isVoiceGuided ? 'primary' : 'secondary'} 
                        size="sm" 
                        onClick={toggleVoiceGuided}
                        className="rounded-full"
                      >
                        {isVoiceGuided ? <MicOff className="w-4 h-4 mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
                        {isVoiceGuided ? 'Stop Voice Guide' : 'Start Voice Guide'}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-6">
                    {currentRecipe.instructions.map((step, i) => (
                      <motion.div 
                        key={i} 
                        className={cn(
                          "flex gap-6 p-4 rounded-2xl transition-all duration-300 cursor-pointer",
                          activeStep === i ? "bg-orange-600/10 border border-orange-600/20 scale-[1.02]" : "opacity-70 hover:opacity-100"
                        )}
                        onClick={() => speakStep(i)}
                      >
                        <span className={cn(
                          "text-2xl font-bold tabular-nums",
                          activeStep === i ? "text-orange-500" : "text-zinc-800"
                        )}>
                          {(i + 1).toString().padStart(2, '0')}
                        </span>
                        <p className={cn(
                          "text-zinc-300 leading-relaxed pt-1",
                          activeStep === i && "text-white font-medium"
                        )}>{step}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {savedRecipes.map((recipe) => (
          <Card key={recipe.id} className="group cursor-pointer hover:border-orange-600/30 transition-all flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <Badge>{recipe.cuisine}</Badge>
              {recipe.nutrition && (
                <span className="text-[10px] font-bold text-zinc-500">{recipe.nutrition.calories} kcal</span>
              )}
            </div>
            <h3 className="text-xl font-bold mb-2 group-hover:text-orange-500 transition-colors">{recipe.title}</h3>
            <p className="text-sm text-zinc-500 line-clamp-2 mb-6 flex-1">{recipe.description}</p>
            <div className="flex items-center justify-between text-xs font-bold text-zinc-600 uppercase tracking-wider">
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {recipe.time}
              </div>
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {recipe.difficulty}
              </div>
            </div>
          </Card>
        ))}
        {savedRecipes.length === 0 && !currentRecipe && (
          <div className="md:col-span-3 text-center py-20 bg-zinc-900/20 border-2 border-dashed border-zinc-900 rounded-3xl">
            <Utensils className="w-16 h-16 mx-auto mb-4 text-zinc-800" />
            <p className="text-zinc-600">No saved recipes yet. Generate one to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
}

function TasteDNA({ user, profile }: { user: FirebaseUser, profile: any }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [prefs, setPrefs] = useState(profile?.preferredCuisine || 'Mediterranean');

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const dna = await analyzeTasteDNA(`I love ${prefs}. I enjoy complex flavors.`);
      await updateDoc(doc(db, 'users', user.uid), {
        tasteDNA: dna,
        preferredCuisine: prefs,
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const dnaData = [
    { subject: 'Sweetness', A: profile?.tasteDNA?.sweetness || 50, fullMark: 100 },
    { subject: 'Saltiness', A: profile?.tasteDNA?.saltiness || 50, fullMark: 100 },
    { subject: 'Spiciness', A: profile?.tasteDNA?.spiciness || 50, fullMark: 100 },
    { subject: 'Umami', A: profile?.tasteDNA?.umami || 50, fullMark: 100 },
    { subject: 'Acidity', A: profile?.tasteDNA?.acidity || 50, fullMark: 100 },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <header>
        <h2 className="text-4xl font-bold tracking-tight">Taste DNA</h2>
        <p className="text-zinc-500">Your unique culinary fingerprint, analyzed by AI.</p>
      </header>

      <div className="grid md:grid-cols-2 gap-8">
        <Card className="flex flex-col items-center justify-center p-12">
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={dnaData}>
                <PolarGrid stroke="#27272a" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#71717a', fontSize: 14, fontWeight: 600 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  name="Taste DNA"
                  dataKey="A"
                  stroke="#ea580c"
                  fill="#ea580c"
                  fillOpacity={0.6}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-8 text-center">
            <p className="text-sm text-zinc-500 uppercase tracking-widest font-bold mb-2">Primary Profile</p>
            <p className="text-3xl font-bold text-white">Balanced Explorer</p>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <h3 className="text-xl font-bold mb-6">Refine Your Profile</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-3">Preferred Cuisine</label>
                <select 
                  value={prefs}
                  onChange={(e) => setPrefs(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:border-orange-600 transition-colors appearance-none"
                >
                  <option>Mediterranean</option>
                  <option>Asian Fusion</option>
                  <option>Classic French</option>
                  <option>Spicy Mexican</option>
                  <option>Nordic Minimalist</option>
                  <option>Traditional Italian</option>
                </select>
              </div>
              <Button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full py-4">
                {isAnalyzing ? 'Analyzing Preferences...' : 'Update Taste DNA'}
                <Brain className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </Card>

          <Card className="bg-orange-600/5 border-orange-600/20">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles className="w-5 h-5 text-orange-500" />
              <h4 className="font-bold">AI Insight</h4>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Your profile shows a strong preference for <span className="text-white font-medium">Umami</span> and <span className="text-white font-medium">Acidity</span>. 
              We'll prioritize recipes with fermented ingredients, citrus highlights, and rich savory bases.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ChefChat({ user, messages, fridgeItems, savedRecipes, profile, onUpgrade }: { user: FirebaseUser, messages: any[], fridgeItems: any[], savedRecipes: any[], profile: any, onUpgrade: () => void }) {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ file: File, preview: string } | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const recognitionRef = React.useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage({ file, preview: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const checkImageLimit = async () => {
    if (profile?.subscription?.status === 'pro') return true;

    const now = new Date();
    const lastUpload = profile?.lastImageUploadAt?.toDate?.() || new Date(0);
    const count = profile?.imageUploadCount || 0;

    // Reset after 24 hours
    if (now.getTime() - lastUpload.getTime() > 24 * 60 * 60 * 1000) {
      return true;
    }

    if (count >= 4) {
      return false;
    }

    return true;
  };

  const handleSend = async (text?: string) => {
    const messageText = text || input;
    if (!messageText.trim() && !selectedImage) return;

    // Check image limit if an image is selected
    if (selectedImage) {
      const canUpload = await checkImageLimit();
      if (!canUpload) {
        const resetTime = new Date((profile?.lastImageUploadAt?.toDate?.() || new Date()).getTime() + 24 * 60 * 60 * 1000);
        alert(`You’ve reached your free image upload limit (4 images). You can upgrade to the premium version for unlimited uploads, or try again after ${resetTime.toLocaleTimeString()}.`);
        onUpgrade();
        return;
      }
    }

    setInput('');
    setIsTyping(true);

    try {
      const chatRef = collection(db, 'users', user.uid, 'chat');
      let imageData: { data: string, mimeType: string } | undefined;

      if (selectedImage) {
        const base64Data = selectedImage.preview.split(',')[1];
        imageData = { data: base64Data, mimeType: selectedImage.file.type };
        
        // Update image upload count
        const now = new Date();
        const lastUpload = profile?.lastImageUploadAt?.toDate?.() || new Date(0);
        let newCount = (profile?.imageUploadCount || 0) + 1;
        
        // Reset count if more than 24h passed
        if (now.getTime() - lastUpload.getTime() > 24 * 60 * 60 * 1000) {
          newCount = 1;
        }

        await updateDoc(doc(db, 'users', user.uid), {
          imageUploadCount: newCount,
          lastImageUploadAt: serverTimestamp()
        });
      }

      await addDoc(chatRef, {
        role: 'user',
        content: messageText || (selectedImage ? "Analyzed an image" : ""),
        imageUrl: selectedImage?.preview || null,
        timestamp: serverTimestamp()
      });

      const context = {
        fridge: fridgeItems.map(i => `${i.quantity} ${i.unit} ${i.name}`),
        recipes: savedRecipes.map(r => r.title),
        profile: profile
      };

      const response = await chatWithChef(messageText, messages.slice(-10), context, imageData);
      
      await addDoc(chatRef, {
        role: 'model',
        content: response,
        timestamp: serverTimestamp()
      });

      setSelectedImage(null);

      // Voice output
      const utterance = new SpeechSynthesisUtterance(response);
      if (/[آ-ی]/.test(response)) {
        utterance.lang = 'ur-PK';
      } else {
        utterance.lang = 'en-US';
      }

      utterance.onend = () => {
        if (voiceMode) {
          startListening();
        }
      };

      window.speechSynthesis.speak(utterance);

    } catch (error) {
      console.error('Chat error:', error);
    } finally {
      setIsTyping(false);
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      handleSend(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const toggleVoiceMode = () => {
    if (voiceMode) {
      setVoiceMode(false);
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      window.speechSynthesis.cancel();
    } else {
      setVoiceMode(true);
      startListening();
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-12rem)] flex flex-col">
      <Card className="flex-1 flex flex-col overflow-hidden p-0">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-600/20 flex items-center justify-center">
              <ChefHat className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="font-bold">Chef AI</h2>
              <p className="text-xs text-zinc-500">Smart Multimodal Assistant</p>
            </div>
          </div>
          {profile?.subscription?.status !== 'pro' && (
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              Images: {profile?.imageUploadCount || 0}/4 Free
            </div>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
          {messages.length === 0 && (
            <div className="text-center py-12 text-zinc-500">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Ask me anything! Type, speak, or upload an image of your food.</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={cn(
                "flex",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "max-w-[80%] p-3 rounded-2xl space-y-2",
                msg.role === 'user' 
                  ? "bg-orange-600 text-white rounded-tr-none" 
                  : "bg-zinc-800 text-zinc-100 rounded-tl-none"
              )}>
                {msg.imageUrl && (
                  <img src={msg.imageUrl} alt="Uploaded" className="rounded-lg max-h-48 w-full object-cover border border-white/10" />
                )}
                <p className="text-sm leading-relaxed">{msg.content}</p>
              </div>
            </motion.div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-zinc-800 p-3 rounded-2xl rounded-tl-none flex gap-1">
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-zinc-500 rounded-full" />
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-zinc-500 rounded-full" />
                <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-zinc-500 rounded-full" />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-800 space-y-4">
          {selectedImage && (
            <div className="relative inline-block">
              <img src={selectedImage.preview} alt="Preview" className="w-20 h-20 object-cover rounded-xl border border-orange-600/50" />
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute -top-2 -right-2 bg-zinc-900 text-white rounded-full p-1 border border-zinc-800"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageSelect} 
              accept="image/*" 
              className="hidden" 
            />
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => fileInputRef.current?.click()}
            >
              <Refrigerator className="w-4 h-4" />
            </Button>
            <Button 
              variant={voiceMode ? 'primary' : 'secondary'} 
              size="sm" 
              onClick={toggleVoiceMode}
              className={cn(voiceMode && "animate-pulse")}
            >
              {voiceMode ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </Button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type your message..."
              className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-orange-600 transition-colors"
            />
            <Button size="sm" onClick={() => handleSend()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function MealPlanner({ user, plans, savedRecipes, isPro, onUpgrade }: { user: FirebaseUser, plans: any[], savedRecipes: any[], isPro: boolean, onUpgrade: () => void }) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const mealTypes = ['breakfast', 'lunch', 'dinner'];

  const addMeal = async (day: string, type: string, recipe: any) => {
    try {
      const mealRef = collection(db, 'users', user.uid, 'mealPlan');
      await addDoc(mealRef, {
        date: day,
        mealType: type,
        recipeId: recipe.id,
        recipeTitle: recipe.title,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'mealPlan');
    }
  };

  if (!isPro) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="w-20 h-20 bg-orange-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <Calendar className="w-10 h-10 text-orange-600" />
        </div>
        <h2 className="text-3xl font-bold mb-4">Weekly Meal Planning</h2>
        <p className="text-zinc-400 mb-8">Take the guesswork out of your week. Plan your meals, track nutrition, and stay organized with ChefAI Pro.</p>
        <Button size="lg" onClick={onUpgrade}>Upgrade to Pro</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Meal Planner</h2>
        <Badge>Pro Feature</Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {days.map(day => (
          <div key={day} className="space-y-4">
            <h3 className="font-bold text-orange-500 text-sm">{day}</h3>
            {mealTypes.map(type => {
              const meal = plans.find(p => p.date === day && p.mealType === type);
              return (
                <Card key={type} className="p-3 bg-zinc-900/30">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{type}</p>
                  {meal ? (
                    <div className="flex items-center justify-between group">
                      <span className="text-xs font-medium truncate">{meal.recipeTitle}</span>
                      <button 
                        onClick={() => deleteDoc(doc(db, 'users', user.uid, 'mealPlan', meal.id))}
                        className="opacity-0 group-hover:opacity-100 text-red-500 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <select 
                      onChange={(e) => {
                        const recipe = savedRecipes.find(r => r.id === e.target.value);
                        if (recipe) addMeal(day, type, recipe);
                      }}
                      className="w-full bg-transparent text-[10px] text-zinc-400 focus:outline-none cursor-pointer"
                    >
                      <option value="">+ Add</option>
                      {savedRecipes.map(r => (
                        <option key={r.id} value={r.id}>{r.title}</option>
                      ))}
                    </select>
                  )}
                </Card>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function GroceryList({ user, items, isPro, onUpgrade }: { user: FirebaseUser, items: any[], isPro: boolean, onUpgrade: () => void }) {
  const [newItem, setNewItem] = useState('');

  const addItem = async () => {
    if (!newItem.trim()) return;
    try {
      const ref = collection(db, 'users', user.uid, 'groceryList');
      await addDoc(ref, {
        name: newItem,
        checked: false,
        addedAt: serverTimestamp()
      });
      setNewItem('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'groceryList');
    }
  };

  const toggleItem = async (id: string, checked: boolean) => {
    try {
      await updateDoc(doc(db, 'users', user.uid, 'groceryList', id), { checked: !checked });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'groceryList');
    }
  };

  if (!isPro) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="w-20 h-20 bg-orange-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShoppingCart className="w-10 h-10 text-orange-600" />
        </div>
        <h2 className="text-3xl font-bold mb-4">Smart Grocery Lists</h2>
        <p className="text-zinc-400 mb-8">Automatically generate grocery lists from your meal plans and keep your kitchen stocked with ChefAI Pro.</p>
        <Button size="lg" onClick={onUpgrade}>Upgrade to Pro</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold">Grocery List</h2>
        <Badge>Pro Feature</Badge>
      </div>

      <Card className="p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
            placeholder="Add item..."
            className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-orange-600"
          />
          <Button onClick={addItem}><Plus className="w-4 h-4" /></Button>
        </div>
      </Card>

      <div className="space-y-2">
        {items.map(item => (
          <motion.div
            key={item.id}
            layout
            className={cn(
              "flex items-center justify-between p-4 rounded-xl border transition-all",
              item.checked ? "bg-zinc-900/30 border-zinc-800 opacity-50" : "bg-zinc-900/50 border-zinc-800"
            )}
          >
            <div className="flex items-center gap-3">
              <button onClick={() => toggleItem(item.id, item.checked)}>
                {item.checked ? <CheckCircle2 className="w-5 h-5 text-orange-600" /> : <div className="w-5 h-5 rounded-full border-2 border-zinc-700" />}
              </button>
              <span className={cn("text-sm", item.checked && "line-through")}>{item.name}</span>
            </div>
            <button onClick={() => deleteDoc(doc(db, 'users', user.uid, 'groceryList', item.id))} className="text-zinc-600 hover:text-red-500">
              <Trash2 className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
        {items.length === 0 && (
          <div className="text-center py-12 text-zinc-600">Your list is empty</div>
        )}
      </div>
    </div>
  );
}

function SubscriptionPlans({ user, currentSub }: { user: FirebaseUser, currentSub: any }) {
  const upgrade = async (plan: string) => {
    try {
      const subRef = doc(db, 'users', user.uid, 'subscription', 'status');
      await setDoc(subRef, {
        status: 'pro',
        plan,
        expiresAt: new Date(Date.now() + (plan === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000).toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'subscription');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-bold tracking-tight">Level Up Your Cooking</h2>
        <p className="text-zinc-400 max-w-2xl mx-auto">Unlock advanced AI features, personalized meal planning, and smart grocery management.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Free Plan */}
        <Card className={cn("flex flex-col", currentSub?.status === 'free' && "border-orange-600/50 ring-1 ring-orange-600/50")}>
          <div className="mb-8">
            <h3 className="text-xl font-bold mb-2">Free</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold">$0</span>
              <span className="text-zinc-500">/forever</span>
            </div>
          </div>
          <ul className="space-y-4 mb-8 flex-1">
            <li className="flex items-center gap-2 text-sm text-zinc-400"><CheckCircle2 className="w-4 h-4 text-orange-600" /> AI Recipe Generation</li>
            <li className="flex items-center gap-2 text-sm text-zinc-400"><CheckCircle2 className="w-4 h-4 text-orange-600" /> Fridge Management</li>
            <li className="flex items-center gap-2 text-sm text-zinc-400"><CheckCircle2 className="w-4 h-4 text-orange-600" /> Taste DNA Analysis</li>
            <li className="flex items-center gap-2 text-sm text-zinc-400"><CheckCircle2 className="w-4 h-4 text-orange-600" /> 4 Image Uploads/day</li>
            <li className="flex items-center gap-2 text-sm text-zinc-400 opacity-30"><X className="w-4 h-4" /> Weekly Meal Planner</li>
            <li className="flex items-center gap-2 text-sm text-zinc-400 opacity-30"><X className="w-4 h-4" /> Smart Grocery Lists</li>
          </ul>
          <Button variant="secondary" disabled={currentSub?.status === 'free'}>
            {currentSub?.status === 'free' ? 'Current Plan' : 'Select'}
          </Button>
        </Card>

        {/* Monthly Pro */}
        <Card className={cn("flex flex-col relative", currentSub?.plan === 'monthly' && "border-orange-600/50 ring-1 ring-orange-600/50")}>
          <div className="mb-8">
            <h3 className="text-xl font-bold mb-2">Pro Monthly</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold">$9.99</span>
              <span className="text-zinc-500">/mo</span>
            </div>
          </div>
          <ul className="space-y-4 mb-8 flex-1">
            <li className="flex items-center gap-2 text-sm text-zinc-100"><CheckCircle2 className="w-4 h-4 text-orange-600" /> All Free Features</li>
            <li className="flex items-center gap-2 text-sm text-zinc-100"><CheckCircle2 className="w-4 h-4 text-orange-600" /> Unlimited Image Uploads</li>
            <li className="flex items-center gap-2 text-sm text-zinc-100"><CheckCircle2 className="w-4 h-4 text-orange-600" /> Weekly Meal Planner</li>
            <li className="flex items-center gap-2 text-sm text-zinc-100"><CheckCircle2 className="w-4 h-4 text-orange-600" /> Smart Grocery Lists</li>
            <li className="flex items-center gap-2 text-sm text-zinc-100"><CheckCircle2 className="w-4 h-4 text-orange-600" /> Priority AI Support</li>
          </ul>
          <Button onClick={() => upgrade('monthly')} disabled={currentSub?.plan === 'monthly'}>
            {currentSub?.plan === 'monthly' ? 'Current Plan' : 'Upgrade Now'}
          </Button>
        </Card>

        {/* Yearly Pro */}
        <Card className={cn("flex flex-col border-orange-600/50 ring-2 ring-orange-600/20 relative overflow-hidden", currentSub?.plan === 'yearly' && "ring-orange-600")}>
          <div className="absolute top-4 right-4">
            <Badge className="bg-orange-600 text-white">Save 20%</Badge>
          </div>
          <div className="mb-8">
            <h3 className="text-xl font-bold mb-2">Pro Yearly</h3>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold">$79.99</span>
              <span className="text-zinc-500">/yr</span>
            </div>
          </div>
          <ul className="space-y-4 mb-8 flex-1">
            <li className="flex items-center gap-2 text-sm text-zinc-100"><CheckCircle2 className="w-4 h-4 text-orange-600" /> Everything in Monthly</li>
            <li className="flex items-center gap-2 text-sm text-zinc-100"><CheckCircle2 className="w-4 h-4 text-orange-600" /> Exclusive Pro Recipes</li>
            <li className="flex items-center gap-2 text-sm text-zinc-100"><CheckCircle2 className="w-4 h-4 text-orange-600" /> Early Access Features</li>
            <li className="flex items-center gap-2 text-sm text-zinc-100"><CheckCircle2 className="w-4 h-4 text-orange-600" /> Personalized Nutrition</li>
          </ul>
          <Button onClick={() => upgrade('yearly')} disabled={currentSub?.plan === 'yearly'}>
            {currentSub?.plan === 'yearly' ? 'Current Plan' : 'Go Pro Yearly'}
          </Button>
        </Card>
      </div>
    </div>
  );
}
