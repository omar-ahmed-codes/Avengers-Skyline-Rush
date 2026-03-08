# Classic Snake

Minimal classic Snake implementation:
- Grid movement
- Food spawning
- Growth + score
- Game-over on wall/self collision
- Restart
- Keyboard (arrow keys/WASD) + on-screen controls

## Run

1. From this repo, start a static file server:
   - `python3 -m http.server 8000`
2. Open `http://localhost:8000`

## Tests

Core game logic tests are in `src/gameLogic.test.js` and use Node's built-in test runner.

- Run: `node --test src/gameLogic.test.js`

## Deploy (Vercel)

- `vercel`
- `vercel --prod`

## Manual verification checklist

- Controls: arrow keys and `WASD` change movement direction.
- Reverse prevention: immediate 180-degree turns are ignored.
- Food: snake grows by 1 and score increments when food is eaten.
- Boundaries: hitting wall ends game.
- Self collision: running into body ends game.
- Pause: press `Space` or click `Pause`, then resume.
- Restart: clicking `Restart` resets board and score.
