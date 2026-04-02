import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  Image as ImageIcon,
  ShoppingCart,
  CreditCard,
  Mic,
  MicOff,
  Volume2,
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
import { generateRecipe, predictCraving, analyzeTasteDNA, chatWithChef, searchRecipeByName, Recipe } from './services/geminiService';
import { resizeImage } from './lib/imageUtils';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { api } from './lib/api';

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
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          'inline-flex items-center justify-center rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className
        )}
        {...props as any}
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
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'fridge' | 'recipes' | 'dna' | 'chat' | 'meal-plan' | 'grocery' | 'subscription'>('dashboard');
  const [fridgeItems, setFridgeItems] = useState<any[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<any[]>([]);
  const [cravings, setCravings] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [mealPlans, setMealPlans] = useState<any[]>([]);
  const [groceryList, setGroceryList] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<{ status: 'free' | 'pro'; plan: string } | null>(null);

  useEffect(() => {
    // Check local storage for user
    const savedUser = localStorage.getItem('chefai_user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        if (u && typeof u === 'object' && u.id) {
          setUser(u);
          fetchUserData(u);
        } else {
          localStorage.removeItem('chefai_user');
          setLoading(false);
        }
      } catch (e) {
        localStorage.removeItem('chefai_user');
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [pendingTargetTab, setPendingTargetTab] = useState<string | null>(null);

  const fetchUserData = async (userObj: any) => {
    if (!userObj || typeof userObj !== 'object' || !userObj.id) {
      setLoading(false);
      return;
    }
    const userId = userObj.id;
    try {
      // Ensure user exists in DB (idempotent)
      await api.createUser(userObj);

      const [profile, fridge, recipes, cravingsData, chat, sub, meal, grocery] = await Promise.all([
        api.getUser(userId),
        api.getFridge(userId),
        api.getRecipes(userId),
        api.getCravings(userId),
        api.getChat(userId),
        api.getSubscription(userId),
        api.getMealPlan(userId),
        api.getGrocery(userId)
      ]);

      setUserProfile(profile);
      setFridgeItems(fridge);
      setSavedRecipes(recipes);
      setCravings(cravingsData);
      setChatMessages(chat);
      setSubscription(sub);
      setMealPlans(meal);
      setGroceryList(grocery);
      setLoading(false);
    } catch (e) {
      console.error('Failed to fetch user data', e);
      setConnectionError("Unable to load your kitchen data. Please try again later.");
      setLoading(false);
    }
  };

  const handleLogin = useCallback(async (email: string, retryCount = 0): Promise<void> => {
    if (!email.includes('@gmail.com')) {
      setConnectionError("Please use a valid Gmail address.");
      setTimeout(() => setConnectionError(null), 3000);
      return;
    }
    
    try {
      // Deterministic ID based on email
      const simpleHash = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0).toString(16);
      const userId = `user_${email.split('@')[0].replace(/[^a-z0-9]/gi, '')}_${simpleHash}`;
      
      const userData = {
        id: userId,
        email: email,
        display_name: email.split('@')[0],
        photo_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`
      };
      
      const u = await api.createUser(userData);
      localStorage.setItem('chefai_user', JSON.stringify(u));
      setUser(u);
      
      if (pendingTargetTab) {
        setActiveTab(pendingTargetTab as any);
        setPendingTargetTab(null);
      }
      
      setIsLoginModalOpen(false);
      await fetchUserData(u);
    } catch (e) {
      console.error('Login/Navigation failed', e);
      if (retryCount < 1) {
        return handleLogin(email, retryCount + 1);
      }
      setConnectionError("Navigation error. Please refresh or try again.");
      setTimeout(() => setConnectionError(null), 5000);
    }
  }, [fetchUserData, pendingTargetTab]);

  const handleLogout = () => {
    localStorage.removeItem('chefai_user');
    setUser(null);
    setUserProfile(null);
  };

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
    return (
      <>
        <LandingPage onLogin={(tab) => {
          setPendingTargetTab(tab || 'dashboard');
          setIsLoginModalOpen(true);
        }} />
        <AnimatePresence>
          {isLoginModalOpen && (
            <LoginModal 
              onClose={() => setIsLoginModalOpen(false)} 
              onLogin={handleLogin} 
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-orange-600/30">
      {connectionError && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {connectionError}
        </div>
      )}
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
              <img src={user.photo_url || ''} alt="" className="w-6 h-6 rounded-full" />
              <span className="text-xs font-medium">{user.display_name}</span>
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
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {activeTab === 'dashboard' && (
              <Dashboard 
                user={user} 
                fridgeItems={fridgeItems} 
                cravings={cravings} 
                userProfile={userProfile} 
                onNavigate={(tab) => setActiveTab(tab)}
                subscription={subscription}
                onRefresh={() => fetchUserData(user.id)}
              />
            )}
            {activeTab === 'fridge' && <FridgeManager user={user} items={fridgeItems} onRefresh={() => fetchUserData(user.id)} />}
            {activeTab === 'recipes' && <RecipeExplorer user={user} fridgeItems={fridgeItems} savedRecipes={savedRecipes} userProfile={userProfile} onRefresh={() => fetchUserData(user.id)} />}
            {activeTab === 'dna' && <TasteDNA user={user} profile={userProfile} onRefresh={() => fetchUserData(user.id)} />}
            {activeTab === 'chat' && (
              <ChefChat 
                user={user} 
                messages={chatMessages} 
                fridgeItems={fridgeItems} 
                savedRecipes={savedRecipes} 
                profile={userProfile} 
                onUpgrade={() => setActiveTab('subscription')} 
                onRefresh={() => fetchUserData(user.id)} 
                onError={(msg) => {
                  setConnectionError(msg);
                  setTimeout(() => setConnectionError(null), 5000);
                }}
              />
            )}
            {activeTab === 'meal-plan' && <MealPlanner user={user} plans={mealPlans} savedRecipes={savedRecipes} isPro={subscription?.status === 'pro'} onUpgrade={() => setActiveTab('subscription')} onRefresh={() => fetchUserData(user.id)} />}
            {activeTab === 'grocery' && <GroceryList user={user} items={groceryList} isPro={subscription?.status === 'pro'} onUpgrade={() => setActiveTab('subscription')} onRefresh={() => fetchUserData(user.id)} />}
            {activeTab === 'subscription' && <SubscriptionPlans user={user} currentSub={subscription} onRefresh={() => fetchUserData(user.id)} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- Sub-components ---

function LoginModal({ onClose, onLogin }: { onClose: () => void, onLogin: (email: string) => void }) {
  const [email, setEmail] = useState('');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative z-10 w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl"
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-white transition-colors">
          <X className="w-5 h-5" />
        </button>
        
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-orange-600/20 rounded-2xl flex items-center justify-center mb-4">
            <ChefHat className="w-8 h-8 text-orange-600" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-2">Welcome to ChefAI</h3>
          <p className="text-zinc-400">Please sign in with your Gmail to continue your culinary journey.</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-zinc-500 ml-1">Gmail Address</label>
            <input 
              type="email" 
              placeholder="chef@gmail.com"
              className="w-full bg-black border border-zinc-800 rounded-2xl px-6 py-4 text-white placeholder:text-zinc-700 focus:border-orange-600 outline-none transition-all"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onLogin(email)}
              autoFocus
            />
          </div>
          <Button 
            className="w-full py-4 rounded-2xl text-lg font-bold"
            onClick={() => onLogin(email)}
          >
            Sign In
          </Button>
          <p className="text-[10px] text-zinc-600 text-center px-4">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function LandingPage({ onLogin }: { onLogin: (targetTab?: string) => void }) {
  return (
    <div className="min-h-screen bg-black text-white selection:bg-orange-600/30 overflow-hidden flex flex-col">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-600/10 via-transparent to-black" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-600/20 rounded-full blur-[120px] animate-pulse" />
      </div>

      <nav className="relative z-20 max-w-7xl mx-auto px-6 w-full h-20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ChefHat className="w-8 h-8 text-orange-600" />
          <span className="text-2xl font-bold tracking-tighter">CHEF<span className="text-orange-600">AI</span></span>
        </div>
        <Button onClick={() => onLogin('dashboard')} className="rounded-full px-8 relative z-30">
          Get Started
        </Button>
      </nav>

      <main className="relative z-20 max-w-7xl mx-auto px-6 flex-1 flex items-center py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center w-full">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative z-30"
          >
            <Badge className="mb-6">Your Personal Culinary Assistant</Badge>
            <h1 className="text-6xl md:text-8xl font-bold tracking-tight leading-[0.9] mb-8">
              Master Your <br />
              <span className="text-orange-600">Kitchen.</span>
            </h1>
            <p className="text-xl text-zinc-400 max-w-lg mb-10 leading-relaxed">
              ChefAI helps you manage your ingredients, discovers recipes you'll love, and provides expert cooking advice tailored to your unique tastes.
            </p>
            <Button size="lg" onClick={() => onLogin('chat')} className="rounded-full px-10 relative z-30">
              Start Cooking <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 relative',
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

function Dashboard({ user, fridgeItems, cravings, userProfile, onNavigate, subscription, onRefresh }: { user: any, fridgeItems: any[], cravings: any[], userProfile: any, onNavigate: (tab: any) => void, subscription: any, onRefresh: () => void }) {
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
        predicted_dish: dish,
        confidence: Math.floor(Math.random() * 20) + 75,
      };

      await api.addCraving(user.id, cravingData);
      setPrediction(cravingData);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setIsPredicting(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-bold tracking-tight">Welcome back, {user.display_name?.split(' ')[0]}</h2>
          <p className="text-zinc-500">Ready to cook something amazing today?</p>
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
        <Card delay={0.1} className="md:col-span-4 lg:col-span-4 relative overflow-hidden group min-h-[320px] flex flex-col justify-center">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <ChefHat className="w-48 h-48 text-orange-600" />
          </div>
          <div className="relative z-10">
            <Badge className="mb-4">Chef's Inspiration</Badge>
            <h3 className="text-3xl font-bold mb-4">What are you craving?</h3>
            <p className="text-zinc-400 mb-8 max-w-md text-lg">Let ChefAI suggest the perfect dish based on your mood and the local weather.</p>
            
            <div className="flex flex-wrap gap-4">
              {prediction ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-orange-600/10 border border-orange-600/20 rounded-2xl p-6 mb-2 max-w-md w-full"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-orange-500">Chef's Recommendation</span>
                    <span className="text-[10px] font-medium text-zinc-500">{prediction.confidence}% Match</span>
                  </div>
                  <p className="text-3xl font-bold text-white mb-4">{prediction.predicted_dish}</p>
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
              
              <Button variant="secondary" size="lg" onClick={() => onNavigate('chat')} className="rounded-full px-8">
                Start Cooking <ChefHat className="ml-2 w-5 h-5" />
              </Button>
            </div>
          </div>
        </Card>

        <Card delay={0.2} className="md:col-span-2 lg:col-span-2 flex flex-col justify-between overflow-hidden">
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

        <Card delay={0.3} className="md:col-span-3 lg:col-span-3">
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
                { subject: 'Sweet', A: userProfile?.taste_dna?.sweetness || 50 },
                { subject: 'Salt', A: userProfile?.taste_dna?.saltiness || 50 },
                { subject: 'Spice', A: userProfile?.taste_dna?.spiciness || 50 },
                { subject: 'Umami', A: userProfile?.taste_dna?.umami || 50 },
                { subject: 'Acid', A: userProfile?.taste_dna?.acidity || 50 },
              ]}>
                <PolarGrid stroke="#27272a" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#71717a', fontSize: 10, fontWeight: 600 }} />
                <Radar name="User" dataKey="A" stroke="#ea580c" fill="#ea580c" fillOpacity={0.6} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card delay={0.4} className="md:col-span-3 lg:col-span-3">
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
                  <p className="text-xs font-bold truncate">{craving.predicted_dish}</p>
                  <p className="text-[9px] text-zinc-600 uppercase tracking-wider">{new Date(craving.timestamp).toLocaleDateString()}</p>
                </div>
              </div>
            )) : (
              <div className="col-span-2 text-center py-12 text-zinc-600">
                <p>No history yet</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function FridgeManager({ user, items, onRefresh }: { user: any, items: any[], onRefresh: () => void }) {
  const [newItem, setNewItem] = useState({ name: '', quantity: '', unit: 'pcs' });

  const handleAdd = async () => {
    if (!newItem.name) return;
    await api.addFridgeItem(user.id, newItem);
    setNewItem({ name: '', quantity: '', unit: 'pcs' });
    onRefresh();
  };

  const handleDelete = async (id: number) => {
    await api.deleteFridgeItem(id);
    onRefresh();
  };

  return (
    <div className="space-y-8">
      <Card>
        <h3 className="text-2xl font-bold mb-6">Add to Fridge</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <input 
            type="text" 
            placeholder="Item Name" 
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 focus:border-orange-600 outline-none"
            value={newItem.name}
            onChange={e => setNewItem({...newItem, name: e.target.value})}
          />
          <input 
            type="text" 
            placeholder="Quantity" 
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 focus:border-orange-600 outline-none"
            value={newItem.quantity}
            onChange={e => setNewItem({...newItem, quantity: e.target.value})}
          />
          <select 
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 focus:border-orange-600 outline-none"
            value={newItem.unit}
            onChange={e => setNewItem({...newItem, unit: e.target.value})}
          >
            <option value="pcs">pcs</option>
            <option value="kg">kg</option>
            <option value="g">g</option>
            <option value="ml">ml</option>
            <option value="l">l</option>
          </select>
          <Button onClick={handleAdd}>Add Item</Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(item => (
          <Card key={item.id} className="flex items-center justify-between">
            <div>
              <p className="font-bold">{item.name}</p>
              <p className="text-sm text-zinc-500">{item.quantity} {item.unit}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RecipeExplorer({ user, fridgeItems, savedRecipes, userProfile, onRefresh }: { user: any, fridgeItems: any[], savedRecipes: any[], userProfile: any, onRefresh: () => void }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedRecipe, setGeneratedRecipe] = useState<Recipe | null>(null);

  const handleGenerate = async () => {
    if (fridgeItems.length === 0) {
      alert("Add some items to your fridge first!");
      return;
    }
    setIsGenerating(true);
    try {
      const ingredients = fridgeItems.map(i => i.name);
      const recipe = await generateRecipe(ingredients, userProfile?.preferred_cuisine);
      setGeneratedRecipe(recipe);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedRecipe) return;
    await api.saveRecipe(user.id, generatedRecipe);
    setGeneratedRecipe(null);
    onRefresh();
  };

  return (
    <div className="space-y-8">
      <Card className="text-center py-12">
        <Utensils className="w-12 h-12 text-orange-600 mx-auto mb-4" />
        <h3 className="text-3xl font-bold mb-4">Generate AI Recipe</h3>
        <p className="text-zinc-500 mb-8 max-w-md mx-auto">We'll use your current fridge items to craft a professional recipe tailored to your Taste DNA.</p>
        <Button size="lg" onClick={handleGenerate} disabled={isGenerating}>
          {isGenerating ? 'Crafting Recipe...' : 'Generate from Fridge'}
        </Button>
      </Card>

      {generatedRecipe && (
        <Card className="border-orange-600/30 bg-orange-600/5">
          <div className="flex justify-between items-start mb-6">
            <div>
              <Badge className="mb-2">New AI Recipe</Badge>
              <h3 className="text-3xl font-bold">{generatedRecipe.title}</h3>
            </div>
            <Button onClick={handleSave}>Save to Collection</Button>
          </div>
          <p className="text-zinc-400 mb-6">{generatedRecipe.description}</p>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h4 className="font-bold mb-4 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-orange-500" /> Ingredients</h4>
              <ul className="space-y-2 text-sm text-zinc-400">
                {generatedRecipe.ingredients.map((ing, i) => <li key={i}>• {ing}</li>)}
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-orange-500" /> Instructions</h4>
              <ol className="space-y-4 text-sm text-zinc-400">
                {generatedRecipe.instructions.map((inst, i) => <li key={i}>{i+1}. {inst}</li>)}
              </ol>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {savedRecipes.map(recipe => (
          <Card key={recipe.id}>
            <div className="flex justify-between items-start mb-4">
              <h4 className="text-xl font-bold">{recipe.title}</h4>
              <Button variant="ghost" size="sm" onClick={() => api.deleteRecipe(recipe.id).then(onRefresh)}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
            <p className="text-sm text-zinc-500 line-clamp-2 mb-4">{recipe.description}</p>
            <div className="flex items-center gap-4 text-xs text-zinc-600">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {recipe.time}</span>
              <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> {recipe.difficulty}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TasteDNA({ user, profile, onRefresh }: { user: any, profile: any, onRefresh: () => void }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [prefs, setPrefs] = useState('');

  const handleAnalyze = async () => {
    if (!prefs) return;
    setIsAnalyzing(true);
    try {
      const dna = await analyzeTasteDNA(prefs);
      await api.updateUser(user.id, { taste_dna: dna });
      onRefresh();
      setPrefs('');
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid md:grid-cols-2 gap-8">
        <Card>
          <h3 className="text-2xl font-bold mb-6">Analyze Your Taste</h3>
          <p className="text-zinc-500 mb-6">Tell us what you like (e.g., "I love spicy Thai food but hate sweet desserts") and we'll update your Taste DNA.</p>
          <textarea 
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 focus:border-orange-600 outline-none h-32 mb-4"
            placeholder="Describe your preferences..."
            value={prefs}
            onChange={e => setPrefs(e.target.value)}
          />
          <Button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full">
            {isAnalyzing ? 'Analyzing DNA...' : 'Update Taste DNA'}
          </Button>
        </Card>

        <Card>
          <h3 className="text-2xl font-bold mb-6">Your Profile</h3>
          <div className="h-64 w-full mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                { subject: 'Sweet', A: profile?.taste_dna?.sweetness || 50 },
                { subject: 'Salt', A: profile?.taste_dna?.saltiness || 50 },
                { subject: 'Spice', A: profile?.taste_dna?.spiciness || 50 },
                { subject: 'Umami', A: profile?.taste_dna?.umami || 50 },
                { subject: 'Acid', A: profile?.taste_dna?.acidity || 50 },
              ]}>
                <PolarGrid stroke="#27272a" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#71717a', fontSize: 10, fontWeight: 600 }} />
                <Radar name="User" dataKey="A" stroke="#ea580c" fill="#ea580c" fillOpacity={0.6} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Preferred Cuisine</span>
              <span className="font-bold text-orange-500">{profile?.preferred_cuisine}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function ChefChat({ user, messages, fridgeItems, savedRecipes, profile, onUpgrade, onRefresh, onError }: { user: any, messages: any[], fridgeItems: any[], savedRecipes: any[], profile: any, onUpgrade: () => void, onRefresh: () => void, onError: (msg: string) => void }) {
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ data: string, mimeType: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const isPro = profile?.status === 'pro';
  const uploadCount = profile?.image_upload_count || 0;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    if (!('webkitSpeciesRecognition' in window) && !('webkitSpeechRecognition' in window)) {
      onError("Speech recognition not supported in this browser.");
      return;
    }
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US'; // Default, but it will pick up other languages
    
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        setInput(transcript);
        // Automatically send after a short delay to allow the state to update
        setTimeout(() => {
          handleSend(transcript);
        }, 100);
      }
    };
    
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };
    
    recognition.start();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isPro && uploadCount >= 3) {
      onError("You have reached the free limit of 3 image uploads. Upgrade to Pro to continue.");
      onUpgrade();
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const resizedBase64 = await resizeImage(base64, 1024, 1024, 0.8);
        const data = resizedBase64.split(',')[1];
        const mimeType = 'image/jpeg';
        setSelectedImage({ data, mimeType });
      } catch (err) {
        console.error("Image resize failed", err);
        const data = base64.split(',')[1];
        const mimeType = file.type;
        setSelectedImage({ data, mimeType });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async (overrideInput?: string) => {
    const currentInput = overrideInput || input;
    if (!currentInput && !selectedImage) return;
    
    const userMsg = { role: 'user' as const, content: currentInput || "Sent an image" };
    await api.addChatMessage(user.id, userMsg);
    
    if (selectedImage) {
      await api.incrementImageCount(user.id);
    }

    const currentImage = selectedImage;
    
    setInput('');
    setSelectedImage(null);
    setIsSending(true);
    onRefresh();

    try {
      const history = messages.map(m => ({ role: m.role as "user" | "model", content: m.content }));
      const context = {
        fridge: fridgeItems.map(i => i.name),
        recipes: savedRecipes.map(r => r.title),
        profile
      };
      const response = await chatWithChef(currentInput, history, context, currentImage || undefined);
      await api.addChatMessage(user.id, { role: 'model', content: response });
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="h-[650px] flex flex-col overflow-hidden border-zinc-800/50 bg-zinc-950/40">
      <div className="flex-1 overflow-y-auto space-y-6 mb-4 pr-2 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
            <ChefHat className="w-12 h-12 mb-4 text-orange-600" />
            <h3 className="text-xl font-bold mb-2">Welcome to Chef AI</h3>
            <p className="text-sm max-w-xs">Ask me about any dish, upload an image of your fridge, or get a recipe for what you're craving!</p>
          </div>
        )}
        {messages.map((m, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={cn("flex flex-col", m.role === 'user' ? "items-end" : "items-start")}
          >
            <div className={cn(
              "max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed shadow-lg",
              m.role === 'user' 
                ? "bg-gradient-to-br from-orange-600 to-orange-700 text-white rounded-tr-none" 
                : "bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-tl-none"
            )}>
              {m.content}
            </div>
            <div className="flex items-center gap-3 mt-1.5 px-1">
              <span className="text-[9px] text-zinc-600 font-medium">
                {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              {m.role === 'model' && (
                <button 
                  onClick={() => speak(m.content)}
                  className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-orange-500 transition-colors font-medium"
                >
                  <Volume2 className="w-3 h-3" />
                  Listen
                </button>
              )}
            </div>
          </motion.div>
        ))}
        {isSending && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex justify-start"
          >
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl rounded-tl-none shadow-lg">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 bg-orange-600 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-orange-600 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 bg-orange-600 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            className="mb-4 relative w-24 h-24 group"
          >
            <img src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} className="w-full h-full object-cover rounded-xl border-2 border-orange-600 shadow-xl" />
            <button 
              onClick={() => setSelectedImage(null)} 
              className="absolute -top-2 -right-2 bg-zinc-900 text-white rounded-full p-1.5 border border-zinc-800 shadow-lg hover:bg-red-600 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">Ready</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative flex items-end gap-2 bg-zinc-900/50 p-2 rounded-2xl border border-zinc-800/50 focus-within:border-orange-600/50 transition-colors">
        <div className="flex items-center">
          <input 
            type="file" 
            accept="image/*" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleImageUpload}
          />
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => fileInputRef.current?.click()}
            className="h-10 w-10 p-0 rounded-xl hover:bg-zinc-800"
          >
            <ImageIcon className="w-5 h-5" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={startListening} 
            className={cn(
              "h-10 w-10 p-0 rounded-xl transition-all duration-300",
              isListening ? "bg-orange-600 text-white animate-pulse" : "hover:bg-zinc-800"
            )}
          >
            {isListening ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </Button>
        </div>
        <textarea 
          className="flex-1 bg-transparent border-none rounded-xl px-2 py-2.5 outline-none text-sm resize-none max-h-32 min-h-[40px] scrollbar-none"
          placeholder="Ask Chef AI..."
          rows={1}
          value={input}
          onChange={e => {
            setInput(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button 
          onClick={() => handleSend()} 
          disabled={isSending || (!input && !selectedImage)}
          className="h-10 w-10 p-0 rounded-xl bg-orange-600 hover:bg-orange-700"
        >
          <Send className="w-5 h-5" />
        </Button>
      </div>
      {!isPro && (
        <p className="mt-2 text-[10px] text-zinc-600 text-center">
          Free image uploads: {uploadCount}/3. <button onClick={onUpgrade} className="text-orange-500 hover:underline">Upgrade to Pro</button>
        </p>
      )}
    </Card>
  );
}

function MealPlanner({ user, plans, savedRecipes, isPro, onUpgrade, onRefresh }: { user: any, plans: any[], savedRecipes: any[], isPro: boolean, onUpgrade: () => void, onRefresh: () => void }) {
  const [newPlan, setNewPlan] = useState({ recipe_id: 0, date: new Date().toISOString().split('T')[0], meal_type: 'Dinner' });

  const handleAdd = async () => {
    if (!newPlan.recipe_id) return;
    await api.addMealPlan(user.id, newPlan);
    onRefresh();
  };

  if (!isPro) {
    return (
      <Card className="text-center py-20">
        <Calendar className="w-12 h-12 text-orange-600 mx-auto mb-4" />
        <h3 className="text-3xl font-bold mb-4">Meal Planning is a Pro Feature</h3>
        <p className="text-zinc-500 mb-8 max-w-md mx-auto">Upgrade to Pro to schedule your meals and sync them with your grocery list.</p>
        <Button onClick={onUpgrade}>Upgrade to Pro</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <h3 className="text-2xl font-bold mb-6">Schedule a Meal</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <select 
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 focus:border-orange-600 outline-none"
            value={newPlan.recipe_id}
            onChange={e => setNewPlan({...newPlan, recipe_id: parseInt(e.target.value)})}
          >
            <option value={0}>Select Recipe</option>
            {savedRecipes.map(r => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
          <input 
            type="date" 
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 focus:border-orange-600 outline-none"
            value={newPlan.date}
            onChange={e => setNewPlan({...newPlan, date: e.target.value})}
          />
          <select 
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 focus:border-orange-600 outline-none"
            value={newPlan.meal_type}
            onChange={e => setNewPlan({...newPlan, meal_type: e.target.value})}
          >
            <option value="Breakfast">Breakfast</option>
            <option value="Lunch">Lunch</option>
            <option value="Dinner">Dinner</option>
            <option value="Snack">Snack</option>
          </select>
          <Button onClick={handleAdd}>Add to Plan</Button>
        </div>
      </Card>

      <div className="space-y-4">
        {plans.map(plan => (
          <Card key={plan.id} className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-zinc-800 rounded-xl text-orange-500 font-bold text-xs">
                {new Date(plan.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              <div>
                <p className="font-bold">{plan.recipe_title}</p>
                <p className="text-xs text-zinc-500">{plan.meal_type}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => api.deleteMealPlan(plan.id).then(onRefresh)}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function GroceryList({ user, items, isPro, onUpgrade, onRefresh }: { user: any, items: any[], isPro: boolean, onUpgrade: () => void, onRefresh: () => void }) {
  const [newItem, setNewItem] = useState({ name: '', quantity: '', unit: 'pcs' });

  const handleAdd = async () => {
    if (!newItem.name) return;
    await api.addGroceryItem(user.id, newItem);
    setNewItem({ name: '', quantity: '', unit: 'pcs' });
    onRefresh();
  };

  if (!isPro) {
    return (
      <Card className="text-center py-20">
        <ShoppingCart className="w-12 h-12 text-orange-600 mx-auto mb-4" />
        <h3 className="text-3xl font-bold mb-4">Grocery Sync is a Pro Feature</h3>
        <p className="text-zinc-500 mb-8 max-w-md mx-auto">Upgrade to Pro to automatically generate grocery lists from your meal plans.</p>
        <Button onClick={onUpgrade}>Upgrade to Pro</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <h3 className="text-2xl font-bold mb-6">Add to List</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <input 
            type="text" 
            placeholder="Item Name" 
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 focus:border-orange-600 outline-none"
            value={newItem.name}
            onChange={e => setNewItem({...newItem, name: e.target.value})}
          />
          <input 
            type="text" 
            placeholder="Qty" 
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 focus:border-orange-600 outline-none"
            value={newItem.quantity}
            onChange={e => setNewItem({...newItem, quantity: e.target.value})}
          />
          <select 
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 focus:border-orange-600 outline-none"
            value={newItem.unit}
            onChange={e => setNewItem({...newItem, unit: e.target.value})}
          >
            <option value="pcs">pcs</option>
            <option value="kg">kg</option>
            <option value="g">g</option>
          </select>
          <Button onClick={handleAdd}>Add</Button>
        </div>
      </Card>

      <div className="space-y-2">
        {items.map(item => (
          <Card key={item.id} className={cn("flex items-center justify-between py-3", item.is_checked && "opacity-50")}>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => api.updateGroceryItem(item.id, !item.is_checked).then(onRefresh)}
                className={cn("w-5 h-5 rounded border flex items-center justify-center", item.is_checked ? "bg-orange-600 border-orange-600" : "border-zinc-700")}
              >
                {item.is_checked && <CheckCircle2 className="w-3 h-3 text-white" />}
              </button>
              <span className={cn(item.is_checked && "line-through")}>{item.name} ({item.quantity} {item.unit})</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => api.deleteGroceryItem(item.id).then(onRefresh)}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SubscriptionPlans({ user, currentSub, onRefresh }: { user: any, currentSub: any, onRefresh: () => void }) {
  const handleUpgrade = async (plan: string) => {
    await api.updateSubscription(user.id, { status: 'pro', plan });
    onRefresh();
  };

  return (
    <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
      <Card className={cn("relative", currentSub?.status === 'free' && "border-orange-600")}>
        {currentSub?.status === 'free' && <Badge className="absolute top-4 right-4">Current Plan</Badge>}
        <h3 className="text-2xl font-bold mb-2">Free Tier</h3>
        <p className="text-4xl font-bold mb-6">$0<span className="text-lg text-zinc-500 font-normal">/mo</span></p>
        <ul className="space-y-4 mb-8 text-zinc-400">
          <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Smart Fridge Inventory</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> AI Recipe Generation</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-500" /> Taste DNA Profile</li>
          <li className="flex items-center gap-2 text-zinc-600"><X className="w-4 h-4" /> Meal Planning</li>
          <li className="flex items-center gap-2 text-zinc-600"><X className="w-4 h-4" /> Grocery List Sync</li>
        </ul>
        <Button variant="secondary" className="w-full" disabled={currentSub?.status === 'free'}>
          {currentSub?.status === 'free' ? 'Active' : 'Downgrade'}
        </Button>
      </Card>

      <Card className={cn("relative border-2", currentSub?.status === 'pro' ? "border-orange-600" : "border-zinc-800")}>
        {currentSub?.status === 'pro' && <Badge className="absolute top-4 right-4">Active</Badge>}
        <h3 className="text-2xl font-bold mb-2">Pro Chef</h3>
        <p className="text-4xl font-bold mb-6">$9.99<span className="text-lg text-zinc-500 font-normal">/mo</span></p>
        <ul className="space-y-4 mb-8 text-zinc-400">
          <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-orange-500" /> Everything in Free</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-orange-500" /> Advanced Meal Planning</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-orange-500" /> Smart Grocery Sync</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-orange-500" /> Priority AI Generation</li>
          <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-orange-500" /> Custom Taste DNA Tuning</li>
        </ul>
        <Button className="w-full" onClick={() => handleUpgrade('monthly')} disabled={currentSub?.status === 'pro'}>
          {currentSub?.status === 'pro' ? 'Pro Active' : 'Upgrade to Pro'}
        </Button>
      </Card>
    </div>
  );
}
