export const GRID_WIDTH = 10;
export const GRID_HEIGHT = 14;
export const SCROLL_ANCHOR_Y = 9;

export const HEROES = [
  {
    id: "captain",
    name: "Captain America",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Chris_Evans_at_the_2025_Toronto_International_Film_Festival_%28cropped%29.jpg/960px-Chris_Evans_at_the_2025_Toronto_International_Film_Festival_%28cropped%29.jpg",
  },
  {
    id: "ironman",
    name: "Iron Man",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Robert_Downey_Jr._2014_Comic-Con.jpg/960px-Robert_Downey_Jr._2014_Comic-Con.jpg",
  },
  {
    id: "thor",
    name: "Thor",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Chris_Hemsworth_-_Crime_101.jpg/960px-Chris_Hemsworth_-_Crime_101.jpg",
  },
  {
    id: "hulk",
    name: "Hulk",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Mark_Ruffalo_%2836201774756%29_%28cropped%29.jpg/960px-Mark_Ruffalo_%2836201774756%29_%28cropped%29.jpg",
  },
  {
    id: "widow",
    name: "Black Widow",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Scarlett_Johansson-8588.jpg/960px-Scarlett_Johansson-8588.jpg",
  },
  {
    id: "strange",
    name: "Doctor Strange",
    image:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Benedict_Cumberbatch-67555.jpg/960px-Benedict_Cumberbatch-67555.jpg",
  },
];

export const VILLAINS = [
  "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Tom_Hiddleston_at_the_2024_Toronto_International_Film_Festival_%28cropped%29.jpg/960px-Tom_Hiddleston_at_the_2024_Toronto_International_Film_Festival_%28cropped%29.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/James_Spader_by_Gage_Skidmore.jpg/960px-James_Spader_by_Gage_Skidmore.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/Josh_Brolin_TIFF_2025_%28cropped%29.jpg/960px-Josh_Brolin_TIFF_2025_%28cropped%29.jpg",
  "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/MJK_08925_Hugo_Weaving_%28Berlinale_2018%29_bw43.jpg/960px-MJK_08925_Hugo_Weaving_%28Berlinale_2018%29_bw43.jpg",
];

const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function randomInt(max, randomFn = Math.random) {
  return Math.floor(randomFn() * max);
}

function levelFromDistance(distance) {
  return 1 + Math.floor(distance / 18);
}

export function isRoadRow(y) {
  return y > 0 && y < GRID_HEIGHT - 1;
}

export function isSafeRow(y) {
  return !isRoadRow(y);
}

function createLane(y, worldRow, laneId, level, randomFn = Math.random) {
  const direction = worldRow % 2 === 0 ? 1 : -1;
  const obstacleCount = level >= 9 && worldRow % 5 === 0 ? 2 : 1;
  const speed = 0.95 + Math.min(1.45, level * 0.045) + randomFn() * 0.22;
  const spacing = GRID_WIDTH / obstacleCount;
  const obstacles = [];

  for (let i = 0; i < obstacleCount; i += 1) {
    obstacles.push({
      id: `${laneId}-${i}`,
      x: i * spacing + randomFn() * 0.9,
      image: VILLAINS[randomInt(VILLAINS.length, randomFn)],
    });
  }

  return {
    id: `lane-${laneId}`,
    y,
    worldRow,
    direction,
    speed,
    obstacles,
  };
}

export function generateLanes(
  level,
  randomFn = Math.random,
  nextLaneIdStart = 0,
  startWorldRow = GRID_HEIGHT - 2,
) {
  const lanes = [];
  let laneId = nextLaneIdStart;

  for (let y = 1; y < GRID_HEIGHT - 1; y += 1) {
    const worldRow = startWorldRow - (y - 1);
    lanes.push(createLane(y, worldRow, laneId, level, randomFn));
    laneId += 1;
  }

  return lanes;
}

export function createInitialState(randomFn = Math.random) {
  const lanes = generateLanes(1, randomFn, 0, GRID_HEIGHT - 2);

  return {
    gridWidth: GRID_WIDTH,
    gridHeight: GRID_HEIGHT,
    heroX: Math.floor(GRID_WIDTH / 2),
    heroY: GRID_HEIGHT - 1,
    heroWorldRow: 0,
    heroIndex: 0,
    score: 0,
    distance: 0,
    level: 1,
    nextWorldRow: GRID_HEIGHT - 1,
    nextLaneId: lanes.length,
    isGameOver: false,
    lanes,
  };
}

export function setHero(state, heroIndex) {
  return { ...state, heroIndex };
}

export function getLaneAt(state, y) {
  return state.lanes.find((lane) => lane.y === y) ?? null;
}

function normalizeX(x, width) {
  const mod = x % width;
  return mod < 0 ? mod + width : mod;
}

function updateLanes(lanes, dt) {
  return lanes.map((lane) => ({
    ...lane,
    obstacles: lane.obstacles.map((obstacle) => ({
      ...obstacle,
      x: obstacle.x + lane.direction * lane.speed * dt,
    })),
  }));
}

function applyHeroMove(state, requestedDirection) {
  const move = DIRECTIONS[requestedDirection];
  if (!move) return state;

  const heroX = Math.min(state.gridWidth - 1, Math.max(0, state.heroX + move.x));
  const heroY = Math.min(state.gridHeight - 1, Math.max(0, state.heroY + move.y));
  const movedUp = heroY < state.heroY;
  const movedDown = heroY > state.heroY;
  const heroWorldRow = Math.max(
    0,
    state.heroWorldRow + (movedUp ? 1 : movedDown ? -1 : 0),
  );
  const distance = Math.max(state.distance, heroWorldRow);

  return {
    ...state,
    heroX,
    heroY,
    heroWorldRow,
    distance,
    score: state.score + (movedUp ? 1 : 0),
  };
}

function scrollForward(state, rows, randomFn = Math.random) {
  let lanes = state.lanes;
  let nextWorldRow = state.nextWorldRow;
  let nextLaneId = state.nextLaneId;

  for (let i = 0; i < rows; i += 1) {
    lanes = lanes.map((lane) => ({
      ...lane,
      y: lane.y + 1,
    }));

    lanes = lanes.filter((lane) => lane.y < state.gridHeight - 1);

    const laneLevel = levelFromDistance(Math.max(state.distance, nextWorldRow));
    lanes.push(createLane(1, nextWorldRow, nextLaneId, laneLevel, randomFn));
    nextWorldRow += 1;
    nextLaneId += 1;
  }

  return {
    lanes,
    nextWorldRow,
    nextLaneId,
  };
}

export function hasCollision(state) {
  const lane = getLaneAt(state, state.heroY);
  if (!lane) return false;

  return lane.obstacles.some((obstacle) => {
    const x = normalizeX(obstacle.x, state.gridWidth);
    const direct = Math.abs(x - state.heroX);
    const wrapped = Math.min(direct, state.gridWidth - direct);
    return wrapped < 0.52;
  });
}

export function stepState(state, requestedDirection, dt = 1 / 60, randomFn = Math.random) {
  if (state.isGameOver) return state;

  let next = applyHeroMove(state, requestedDirection);
  next = {
    ...next,
    level: levelFromDistance(next.distance),
    lanes: updateLanes(next.lanes, dt),
  };

  if (hasCollision(next)) {
    return {
      ...next,
      isGameOver: true,
    };
  }

  if (next.heroY < SCROLL_ANCHOR_Y) {
    const rows = SCROLL_ANCHOR_Y - next.heroY;
    const scrolled = scrollForward(next, rows, randomFn);

    next = {
      ...next,
      heroY: SCROLL_ANCHOR_Y,
      ...scrolled,
    };

    if (hasCollision(next)) {
      return {
        ...next,
        isGameOver: true,
      };
    }
  }

  return next;
}
