import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Basic Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// Get a random word
app.get('/api/word', async (req, res) => {
  const count = await prisma.word.count();
  const randomIndex = Math.floor(Math.random() * count);
  const word = await prisma.word.findMany({
    skip: randomIndex,
    take: 1,
  });
  res.json(word[0]);
});

// Validate a guess
app.post('/api/guess', async (req, res) => {
  const { guess, targetWord } = req.body;
  // TODO: Implement color feedback logic (green, yellow, gray)
  const result = guess.split('').map((letter: string, index: number) => {
    if (letter === targetWord[index]) return 'green';
    if (targetWord.includes(letter)) return 'yellow';
    return 'gray';
  });
  res.json({ result });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
