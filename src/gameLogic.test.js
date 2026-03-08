import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  generateLanes,
  GRID_HEIGHT,
  hasCollision,
  isRoadRow,
  SCROLL_ANCHOR_Y,
  setHero,
  stepState,
} from "./gameLogic.js";

test("hero moves up and increments score and world progress", () => {
  const initial = {
    ...createInitialState(() => 0),
    heroX: 4,
    heroY: 10,
    heroWorldRow: 0,
    distance: 0,
    lanes: [],
  };

  const next = stepState(initial, "up", 1 / 60);
  assert.equal(next.heroY, 9);
  assert.equal(next.score, 1);
  assert.equal(next.heroWorldRow, 1);
  assert.equal(next.distance, 1);
  assert.equal(next.isGameOver, false);
});

test("collision with villain lane ends game", () => {
  const initial = {
    ...createInitialState(() => 0),
    heroX: 4,
    heroY: 3,
    lanes: [
      {
        id: "lane-1",
        y: 3,
        worldRow: 5,
        direction: 1,
        speed: 0,
        obstacles: [{ id: "1-0", x: 4, image: "x" }],
      },
    ],
  };

  const next = stepState(initial, null, 1 / 60);
  assert.equal(next.isGameOver, true);
});

test("scrolling keeps hero in frame and advances lane stream", () => {
  const initial = {
    ...createInitialState(() => 0),
    heroY: SCROLL_ANCHOR_Y,
    heroWorldRow: 10,
    distance: 10,
  };
  const previousMaxWorldRow = Math.max(...initial.lanes.map((lane) => lane.worldRow));

  const next = stepState(initial, "up", 1 / 60, () => 0);

  assert.equal(next.heroY, SCROLL_ANCHOR_Y);
  assert.equal(next.heroWorldRow, 11);
  assert.equal(next.distance, 11);
  assert.equal(next.lanes.length, GRID_HEIGHT - 2);
  assert.equal(Math.min(...next.lanes.map((lane) => lane.y)), 1);
  assert.equal(Math.max(...next.lanes.map((lane) => lane.y)), GRID_HEIGHT - 2);
  assert.equal(Math.max(...next.lanes.map((lane) => lane.worldRow)), previousMaxWorldRow + 1);
});

test("lane generation covers all playable rows", () => {
  const lanes = generateLanes(1, () => 0.2);
  assert.equal(lanes.length, GRID_HEIGHT - 2);
  assert.equal(lanes.every((lane) => isRoadRow(lane.y)), true);
  assert.equal(lanes[0].y, 1);
  assert.equal(lanes.at(-1).y, GRID_HEIGHT - 2);
  assert.equal(lanes[0].worldRow > lanes.at(-1).worldRow, true);
});

test("hasCollision checks wrapped x position", () => {
  const state = {
    ...createInitialState(() => 0),
    heroX: 0,
    heroY: 3,
    lanes: [
      {
        id: "lane-wrap",
        y: 3,
        worldRow: 9,
        direction: 1,
        speed: 0,
        obstacles: [{ id: "w-0", x: 9.8, image: "x" }],
      },
    ],
  };

  assert.equal(hasCollision(state), true);
});

test("setHero updates selected hero index", () => {
  const initial = createInitialState();
  const next = setHero(initial, 4);
  assert.equal(next.heroIndex, 4);
});
