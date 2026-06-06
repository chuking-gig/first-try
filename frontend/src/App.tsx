import { useState, useEffect } from 'react'

type FeedbackColor = 'green' | 'yellow' | 'gray' | 'none';
type View = 'landing' | 'login' | 'signup' | 'game' | 'stats';

interface StatsData {
  user: {
    totalGames: number;
    passed: number;
    failed: number;
    avgAttempts: number;
    winRate: number;
  };
  global: {
    avgAttempts: number;
    winRate: number;
  };
}

function App() {
  const [view, setView] = useState<View>('landing');
  const [isInitializing, setIsInitializing] = useState(true);
  const [user, setUser] = useState<{ username: string; userId: number } | null>(null);
  const [authError, setAuthError] = useState('');
  const [stats, setStats] = useState<StatsData | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'error' } | null>(null);
  
  const [gameId, setGameId] = useState('');
  const [isGameLoading, setIsGameLoading] = useState(false);
  const [targetWord, setTargetWord] = useState('');
  const [guesses, setGuesses] = useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [feedback, setFeedback] = useState<FeedbackColor[][]>([]);
  const [gameState, setGameState] = useState<'playing' | 'won' | 'lost'>('playing');

  const API_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5001/api' 
    : 'https://first-try-vl8h.onrender.com/api';

  useEffect(() => {
    const init = async () => {
      try {
        // 1. Check for persisted user session
        const savedUser = localStorage.getItem('wordle_user');
        if (savedUser) {
          console.log('[Auth] Restoring persisted session...');
          setUser(JSON.parse(savedUser));
          setView('game'); // Go straight to game if remembered
        }

        // 2. Ping server to check if it's awake
        await fetch(`${API_URL}/health`);
      } catch (e) {
        console.log('Server is still sleeping or session error...');
      } finally {
        setIsInitializing(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (view === 'game') {
      startNewGame();
    } else if (view === 'stats' && user) {
      fetchStats();
    }
  }, [view]);

  const showNotification = (message: string, type: 'info' | 'error' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const startNewGame = async () => {
    console.log('[Game] Starting new game...');
    setIsGameLoading(true);
    
    // Timer to show 'Waking up' message if server is slow (Cold Start)
    const wakeUpTimer = setTimeout(() => {
      showNotification('Waking up server... this may take a moment on first load', 'info');
    }, 3000);

    try {
      const response = await fetch(`${API_URL}/word`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch game session');
      }

      const data = await response.json();
      console.log('[Game] Received gameId from server:', data.gameId);
      
      if (!data.gameId) {
        throw new Error('Server did not return a gameId');
      }

      setGameId(data.gameId);
      setGuesses([]);
      setFeedback([]);
      setCurrentGuess('');
      setGameState('playing');
      setTargetWord('');
    } catch (error: any) {
      console.error('[Game] Failed to start game:', error);
      showNotification(error.message || 'Failed to connect to server', 'error');
    } finally {
      clearTimeout(wakeUpTimer);
      setIsGameLoading(false);
      console.log('[Game] Game loading finished.');
    }
  };

  const fetchStats = async () => {
    if (!user) return;
    try {
      const response = await fetch(`${API_URL}/stats/${user.userId}`);
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      showNotification('Failed to load stats', 'error');
    }
  };

  const handleAuth = async (endpoint: 'signup' | 'login', formData: any) => {
    setAuthError('');
    try {
      const response = await fetch(`${API_URL}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (endpoint === 'login') {
        setUser({ username: data.username, userId: data.userId });
        localStorage.setItem('wordle_user', JSON.stringify({ username: data.username, userId: data.userId }));
        setView('game');
      } else {
        showNotification('Account created! Please login.', 'info');
        setView('login');
      }
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handleGuess = async () => {
    console.log('[Guess] Attempting guess:', currentGuess);
    console.log('[Guess] Current gameId state:', gameId);
    
    if (currentGuess.length !== 5) {
      console.log('[Guess] Aborted: guess length is not 5');
      return;
    }
    
    if (!gameId) {
      console.warn('[Guess] Aborted: No gameId found! Attempting to recover...');
      showNotification('Starting a new game session...', 'info');
      await startNewGame();
      return;
    }
    
    if (guesses.includes(currentGuess)) {
      console.log('[Guess] Aborted: word already guessed');
      showNotification('You already guessed this word!', 'error');
      return;
    }
    
    try {
      console.log('[Guess] Sending request to /api/guess with gameId:', gameId);
      const response = await fetch(`${API_URL}/guess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guess: currentGuess, gameId, userId: user?.userId }),
      });
      const data = await response.json();
      console.log('[Guess] Server response:', data);
      
      if (!response.ok) {
        console.error('[Guess] Server returned error:', data.error);
        if (data.error === 'Word not in word list') {
          setIsShaking(true);
          setTimeout(() => setIsShaking(false), 500);
        }
        showNotification(data.error || 'Invalid guess', 'error');
        return;
      }

      const newGuesses = [...guesses, currentGuess];
      const newFeedback = [...feedback, data.result];
      
      setGuesses(newGuesses);
      setFeedback(newFeedback);
      setCurrentGuess('');

      if (data.targetWord) {
        setTargetWord(data.targetWord);
        if (currentGuess === data.targetWord) {
          setGameState('won');
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#22c55e', '#3b82f6', '#ffffff']
          });
        } else {
          setGameState('lost');
        }
      } else if (newGuesses.length >= 6) {
        setGameState('lost');
      }
    } catch (error) {
      console.error('Error submitting guess:', error);
      showNotification('Server error occurred', 'error');
    }
  };

  const onKeyPress = (key: string) => {
    if (gameState !== 'playing' || isGameLoading) return;
    if (key === 'ENTER') {
      handleGuess();
    } else if (key === 'BACKSPACE') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (currentGuess.length < 5 && /^[A-Z]$/.test(key)) {
      setCurrentGuess(prev => prev + key);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (view !== 'game') return;
      const key = e.key.toUpperCase();
      if (key === 'ENTER') onKeyPress('ENTER');
      else if (key === 'BACKSPACE') onKeyPress('BACKSPACE');
      else onKeyPress(key);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentGuess, gameState, view]);

  const getKeyboardKeyColor = (key: string): string => {
    const priority: Record<FeedbackColor, number> = {
      'green': 3,
      'yellow': 2,
      'gray': 1,
      'none': 0
    };

    let maxPriority = 0;
    let bestColor: FeedbackColor = 'none';

    for (let rowIndex = 0; rowIndex < feedback.length; rowIndex++) {
      const row = feedback[rowIndex];
      for (let index = 0; index < row.length; index++) {
        const color = row[index];
        if (guesses[rowIndex]?.[index] === key) {
          if (priority[color] > maxPriority) {
            maxPriority = priority[color];
            bestColor = color;
          }
        }
      }
    }

    switch (bestColor) {
      case 'green': return 'bg-green-600 text-white';
      case 'yellow': return 'bg-yellow-600 text-white';
      case 'gray': return 'bg-gray-700 text-gray-300';
      default: return 'bg-gray-500 text-white';
    }
  };

  const keyboardRows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE'],
  ];

  // --- View Components ---

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 font-sans">
        <div className="flex flex-col items-center gap-8">
          {/* Bouncing Wordle Grid Animation */}
          <div className="grid grid-cols-5 gap-2">
            {[...Array(15)].map((_, i) => (
              <div 
                key={i} 
                className="w-8 h-8 bg-gray-700 rounded-sm animate-bounce"
                style={{ animationDelay: `${i * 100}ms` }}
              ></div>
            ))}
          </div>
          
          <div className="text-center space-y-2">
            <p className="text-2xl font-black tracking-widest uppercase text-blue-400 animate-pulse">
              Waking up the tiles...
            </p>
            <p className="text-gray-500 text-sm italic">Just a moment!</p>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 font-sans">
        {notification && (
          <div className={`fixed top-5 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl z-50 transition-all animate-bounce ${notification.type === 'error' ? 'bg-red-600' : 'bg-blue-600'} font-bold`}>
            {notification.message}
          </div>
        )}
        <div className="text-center space-y-8 animate-fade-in">
          <h1 className="text-6xl font-black tracking-tighter uppercase italic text-blue-500">Wordle</h1>
          <p className="text-gray-400 text-lg max-w-xs mx-auto">
            The world's favorite word game. Challenge your brain and climb the leaderboard.
          </p>
          <div className="flex flex-col gap-4 w-64 mx-auto">
            <button 
              onClick={() => setView('login')}
              className="bg-blue-600 hover:bg-blue-700 py-3 rounded-xl font-bold text-xl transition-all active:scale-95 shadow-lg"
            >
              Login
            </button>
            <button 
              onClick={() => setView('signup')}
              className="bg-gray-800 hover:bg-gray-700 py-3 rounded-xl font-bold text-xl transition-all active:scale-95 border border-gray-600"
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'login' || view === 'signup') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 font-sans">
        {notification && (
          <div className={`fixed top-5 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl z-50 transition-all animate-bounce ${notification.type === 'error' ? 'bg-red-600' : 'bg-blue-600'} font-bold`}>
            {notification.message}
          </div>
        )}
        <div className="w-full max-w-sm bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700 space-y-6">
          <h2 className="text-3xl font-bold text-center uppercase tracking-tight">
            {view === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const formData = new FormData(form);
            handleAuth(view, Object.fromEntries(formData));
          }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
              <input 
                name="username"
                required
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="Enter username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
              <input 
                name="password"
                type="password"
                required
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="Enter password"
              />
            </div>
            {authError && <p className="text-red-400 text-sm text-center">{authError}</p>}
            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-bold transition-all active:scale-95"
            >
              {view === 'login' ? 'Login' : 'Sign Up'}
            </button>
          </form>
          
          <div className="text-center text-sm text-gray-400">
            {view === 'login' ? (
              <p>Don't have an account? <button onClick={() => setView('signup')} className="text-blue-400 hover:underline">Sign Up</button></p>
            ) : (
              <p>Already have an account? <button onClick={() => setView('login')} className="text-blue-400 hover:underline">Login</button></p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'stats') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 font-sans">
        {notification && (
          <div className={`fixed top-5 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl z-50 transition-all animate-bounce ${notification.type === 'error' ? 'bg-red-600' : 'bg-blue-600'} font-bold`}>
            {notification.message}
          </div>
        )}
        <header className="w-full max-w-md flex justify-between items-center border-b border-gray-700 pb-4 mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('game')} className="text-gray-400 hover:text-white transition-colors">
              ← Back to Game
            </button>
            <h1 className="text-2xl font-bold uppercase tracking-tight">My Performance</h1>
          </div>
        </header>

        <div className="w-full max-w-md space-y-6">
          {!stats ? (
            <div className="text-center py-12 text-gray-500">Loading statistics...</div>
          ) : (
            <>
              {/* User Stats Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 p-4 rounded-2xl border border-gray-700 text-center">
                  <p className="text-gray-400 text-xs uppercase font-bold">Games Played</p>
                  <p className="text-3xl font-black text-blue-400">{stats.user.totalGames}</p>
                </div>
                <div className="bg-gray-800 p-4 rounded-2xl border border-gray-700 text-center">
                  <p className="text-gray-400 text-xs uppercase font-bold">Win Rate</p>
                  <p className="text-3xl font-black text-green-400">{stats.user.winRate}%</p>
                </div>
                <div className="bg-gray-800 p-4 rounded-2xl border border-gray-700 text-center">
                  <p className="text-gray-400 text-xs uppercase font-bold">Passed</p>
                  <p className="text-3xl font-black text-green-500">{stats.user.passed}</p>
                </div>
                <div className="bg-gray-800 p-4 rounded-2xl border border-gray-700 text-center">
                  <p className="text-gray-400 text-xs uppercase font-bold">Failed</p>
                  <p className="text-3xl font-black text-red-500">{stats.user.failed}</p>
                </div>
              </div>

              {/* Comparison Section */}
              <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 space-y-6">
                <h3 className="text-lg font-bold uppercase text-center text-gray-300 border-b border-gray-700 pb-2">Global Comparison</h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Avg Attempts</span>
                    <div className="flex gap-4">
                      <span className="font-bold text-blue-400">{stats.user.avgAttempts}</span>
                      <span className="text-xs text-gray-500">Global: {stats.global.avgAttempts}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Win Rate</span>
                    <div className="flex gap-4">
                      <span className="font-bold text-green-400">{stats.user.winRate}%</span>
                      <span className="text-xs text-gray-500">Global: {stats.global.winRate}%</span>
                    </div>
                  </div>
                </div>
                
                <div className="pt-4 text-center">
                  <p className="text-sm italic text-gray-500">
                    {stats.user.avgAttempts < stats.global.avgAttempts 
                      ? "🚀 You're faster than the average player!" 
                      : "📈 Keep practicing to beat the global average!"}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-between p-4 font-sans">
      {notification && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl z-50 transition-all animate-bounce ${notification.type === 'error' ? 'bg-red-600' : 'bg-blue-600'} font-bold`}>
          {notification.message}
        </div>
      )}
      <header className="w-full max-w-md flex justify-between items-center border-b border-gray-700 pb-2 mb-4 px-2">
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <button onClick={() => setView('landing')} className="text-gray-400 hover:text-white transition-colors">
            ←
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-widest uppercase">Wordle</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
          <button 
            onClick={() => setView('stats')}
            className="text-[10px] sm:text-xs bg-blue-600 hover:bg-blue-700 px-2 sm:px-3 py-1 rounded-full font-bold transition-colors shadow-md whitespace-nowrap"
          >
            {window.innerWidth < 640 ? 'Stats' : 'My Performance'}
          </button>
          <span className="text-xs sm:text-sm font-medium text-gray-400 truncate max-w-[60px] sm:max-w-none">
            {user?.username}
          </span>
          <button 
            onClick={() => { 
              setUser(null); 
              localStorage.removeItem('wordle_user'); 
              setView('landing'); 
            }}
            className="text-[10px] sm:text-xs bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded border border-gray-600 transition-colors whitespace-nowrap"
          >
            Logout
          </button>
        </div>
      </header>
      
      <div className="flex-grow flex flex-col items-center justify-center gap-4">
        <div className="grid grid-rows-6 gap-1 sm:gap-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="grid grid-cols-5 gap-1 sm:gap-2">
              {[...Array(5)].map((_, j) => {
                const char = i < guesses.length 
                  ? guesses[i][j] 
                  : (i === guesses.length ? currentGuess[j] : '');
                const colorClass = feedback[i]?.[j] === 'green' ? 'bg-green-600 border-green-600' : 
                                   feedback[i]?.[j] === 'yellow' ? 'bg-yellow-600 border-yellow-600' : 
                                   feedback[i]?.[j] === 'gray' ? 'bg-gray-600 border-gray-600' : 
                                   'bg-transparent border-gray-600';
                const isCurrent = i === guesses.length;

                return (
                  <Tile 
                    char={char} 
                    color={feedback[i]?.[j] || 'none'} 
                    index={j} 
                    isCurrent={isCurrent} 
                    isShaking={isShaking} 
                  />
                );
              })}
            </div>
          ))}
        </div>

        {gameState !== 'playing' && (
          <div className="mt-4 p-4 bg-gray-800 rounded-lg shadow-xl text-center animate-bounce w-full max-w-xs">
            <p className={`text-xl sm:text-2xl font-bold ${gameState === 'won' ? 'text-green-400' : 'text-red-400'}`}>
              {gameState === 'won' ? '🎉 You Won!' : `❌ Game Over! Word was ${targetWord || 'Unknown'}`}
            </p>
            <button 
              onClick={startNewGame} 
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-bold transition-colors"
            >
              Play Again
            </button>
          </div>
        )}
      </div>

      <div className="w-full max-w-md mb-8 px-2">
        <div className="flex flex-col gap-2">
          {keyboardRows.map((row, i) => (
            <div key={i} className="flex justify-center gap-1 sm:gap-1.5">
              {row.map(key => (
                <button
                  key={key}
                  onClick={() => onKeyPress(key)}
                  className={`h-12 sm:h-14 rounded font-bold uppercase transition-all active:scale-95 ${
                    key.length > 1 ? 'px-2 sm:px-3 text-[10px] sm:text-xs' : 'w-8 sm:w-10 md:w-11'
                  } ${getKeyboardKeyColor(key)}`}
                >
                  {key === 'BACKSPACE' ? '⌫' : key}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default App
