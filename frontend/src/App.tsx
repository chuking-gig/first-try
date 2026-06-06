import { useState, useEffect } from 'react'

function App() {
  const [targetWord, setTargetWord] = useState('');
  const [guesses, setGuesses] = useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = useState('');
  const [feedback, setFeedback] = useState<string[][]>([]);

  const API_URL = 'http://localhost:5001/api';

  useEffect(() => {
    fetchWord();
  }, []);

  const fetchWord = async () => {
    try {
      const response = await fetch(`${API_URL}/word`);
      const data = await response.json();
      setTargetWord(data.text);
    } catch (error) {
      console.error('Failed to fetch word:', error);
    }
  };

  const handleGuess = async () => {
    if (currentGuess.length !== 5) return;
    
    try {
      const response = await fetch(`${API_URL}/guess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guess: currentGuess, targetWord }),
      });
      const data = await response.json();
      setGuesses([...guesses, currentGuess]);
      setFeedback([...feedback, data.result]);
      setCurrentGuess('');
    } catch (error) {
      console.error('Error submitting guess:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-8">
      <h1 className="text-4xl font-bold mb-8">Wordle Clone</h1>
      
      <div className="grid grid-rows-6 gap-2 mb-8">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="grid grid-cols-5 gap-2">
            {[...Array(5)].map((_, j) => {
              const char = (guesses[i] || currentGuess)[j] || '';
              const color = feedback[i]?.[j] === 'green' ? 'bg-green-600' : feedback[i]?.[j] === 'yellow' ? 'bg-yellow-600' : feedback[i]?.[j] === 'gray' ? 'bg-gray-600' : 'bg-gray-800';
              return (
                <div key={j} className={`w-12 h-12 border-2 border-gray-700 flex items-center justify-center text-2xl font-bold uppercase ${color}`}>
                  {char}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <input
        type="text"
        maxLength={5}
        value={currentGuess}
        onChange={(e) => setCurrentGuess(e.target.value.toUpperCase())}
        className="p-2 border border-gray-700 rounded bg-gray-800 text-white mb-4"
      />
      <button onClick={handleGuess} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Submit</button>
    </div>
  )
}

export default App
