#!/bin/bash
USER_ID=3

# 1. Start a game
GAME_RESPONSE=$(curl -s http://localhost:5001/api/word)
GAME_ID=$(echo $GAME_RESPONSE | grep -o '"gameId":"[^"]*' | cut -d'"' -f4)
echo "Game Started. ID: $GAME_ID"

# 2. Make 6 failing guesses using valid words from the seed list
GUESSES=("about" "above" "abuse" "abyss" "ached" "aches")

for guess in "${GUESSES[@]}"
do
  curl -s -X POST http://localhost:5001/api/guess 
       -H "Content-Type: application/json" 
       -d "{"guess": "$guess", "gameId": "$GAME_ID", "userId": $USER_ID}" > /dev/null
done
echo "Game ended with failure."

# 3. Check stats
echo "Fetching stats for User $USER_ID..."
curl -s http://localhost:5001/api/stats/$USER_ID
echo -e "
"
