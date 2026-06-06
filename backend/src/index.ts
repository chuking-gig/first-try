import express, { Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { exec } from 'child_process';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5001;

// Auto-sync database schema on startup
async function syncDatabase() {
  console.log('[DB] Checking database schema sync...');
  return new Promise((resolve) => {
    exec('npx prisma db push', (error, stdout, stderr) => {
      if (error) {
        console.error('[DB] Sync error:', stderr);
      } else {
        console.log('[DB] Database synced successfully');
      }
      resolve();
    });
  });
}

app.use(cors());
app.use(express.json());

// Remove the in-memory store for active games
// const games = new Map<string, { word: string, attempts: number }>();

// Basic Health Check
app.get('/api/health', (req: Request, res: Response) => {

  res.json({ status: 'ok', message: 'Backend is running' });
});

// --- Authentication Endpoints ---
app.post('/api/signup', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  try {
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { username, password: hashedPassword },
    });
    res.status(201).json({ message: 'User created successfully', userId: user.id });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error during signup' });
  }
});

app.post('/api/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    res.json({ message: 'Login successful', userId: user.id, username: user.username });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// Start a new game and get a gameId
app.get('/api/word', async (req: Request, res: Response) => {
  try {
    const count = await prisma.word.count();
    if (count === 0) {
      return res.status(500).json({ error: 'No words found in database. Please seed it.' });
    }
    const randomIndex = Math.floor(Math.random() * count);
    const words = await prisma.word.findMany({
      skip: randomIndex,
      take: 1,
    });
    
    const targetWord = words[0].text;
    const gameId = uuidv4();

    // Save session to database
    await prisma.gameSession.create({
      data: {
        id: gameId,
        word: targetWord,
        attempts: 0
      }
    });
    
    res.json({ gameId });
  } catch (error: any) {
    console.error('[Server Error] Failed to fetch random word:', error);
    res.status(500).json({ 
      error: 'Failed to fetch random word', 
      debug_message: error.message 
    });
  }
});

// Validate a guess using gameId
app.post('/api/guess', async (req: Request, res: Response) => {
  const { guess, gameId, userId } = req.body;
  
  if (!gameId) {
    return res.status(400).json({ error: 'Game ID is required' });
  }

  // Fetch session from database
  const session = await prisma.gameSession.findUnique({
    where: { id: gameId }
  });

  if (!session) {
    return res.status(400).json({ error: 'Invalid or expired game session' });
  }

  // Check if the guess is a valid 5-letter word from our dictionary
  const validWord = await prisma.word.findUnique({
    where: { text: (guess as string).toUpperCase() },
  });

  if (!validWord) {
    return res.status(400).json({ error: 'Word not in word list' });
  }

  const targetWord = session.word;
  const attempts = session.attempts + 1;
  
  // Update attempts in database
  await prisma.gameSession.update({
    where: { id: gameId },
    data: { attempts }
  });

  const result = (guess as string).split('').map((letter: string, index: number) => {
    if (letter === targetWord[index]) return 'green';
    if (targetWord.includes(letter)) return 'yellow';
    return 'gray';
  });

  const response: any = { result };
  
  // Reveal word if won OR if max attempts (6) reached
  if (guess === targetWord || attempts >= 6) {
    response.targetWord = targetWord;
    
    // Save result to database
    if (userId) {
      await prisma.gameResult.create({
        data: {
          word: targetWord,
          success: guess === targetWord,
          attempts: attempts,
          userId: userId,
        },
      });
    }
    
    // End game session in database
    await prisma.gameSession.delete({
      where: { id: gameId }
    });
  }

  res.json(response);
});

// Performance Analytics Endpoint
app.get('/api/stats/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const uId = parseInt(userId as string);

    // User Stats
    const userResults = await prisma.gameResult.findMany({ where: { userId: uId } });
    const totalGames = userResults.length;
    const passed = userResults.filter(r => r.success).length;
    const failed = totalGames - passed;
    const avgAttempts = totalGames > 0 
      ? userResults.reduce((acc, r) => acc + r.attempts, 0) / totalGames 
      : 0;

    // Global Stats
    const allResults = await prisma.gameResult.findMany();
    const globalTotal = allResults.length;
    const globalPassed = allResults.filter(r => r.success).length;
    const globalAvgAttempts = globalTotal > 0 
      ? allResults.reduce((acc, r) => acc + r.attempts, 0) / globalTotal 
      : 0;

    res.json({
      user: {
        totalGames,
        passed,
        failed,
        avgAttempts: parseFloat(avgAttempts.toFixed(2)),
        winRate: totalGames > 0 ? parseFloat(((passed / totalGames) * 100).toFixed(2)) : 0,
      },
      global: {
        avgAttempts: parseFloat(globalAvgAttempts.toFixed(2)),
        winRate: globalTotal > 0 ? parseFloat(((globalPassed / globalTotal) * 100).toFixed(2)) : 0,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

async function startServer() {
  try {
    await syncDatabase();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Fatal error during server startup:', error);
    process.exit(1);
  }
}

startServer();

