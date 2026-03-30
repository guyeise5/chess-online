import UserPreferences from "../models/UserPreferences";
import { setupDB, teardownDB, clearDB } from "./setup";

beforeAll(async () => {
  await setupDB();
});

afterEach(async () => {
  await clearDB();
});

afterAll(async () => {
  await teardownDB();
});

describe("UserPreferences model", () => {
  it("uses collection userpreferences", () => {
    expect(UserPreferences.collection.collectionName).toBe("userpreferences");
  });

  it("has a unique index on userId", async () => {
    await UserPreferences.createIndexes();
    const indexes = await UserPreferences.collection.indexes();
    const userIdIndex = indexes.find((idx) => idx.key?.userId === 1);

    expect(userIdIndex).toBeDefined();
    expect(userIdIndex?.unique).toBe(true);
  });

  it("requires userId", async () => {
    const doc = new UserPreferences({});
    const err = doc.validateSync();

    expect(err).toBeDefined();
    expect(err?.errors).toHaveProperty("userId");
  });

  it("applies defaults when only userId is set", async () => {
    const doc = await UserPreferences.create({ userId: "alice-id" });

    expect(doc.displayName).toBe("");
    expect(doc.introSeen).toBe(false);
    expect(doc.locale).toBe("en");
    expect(doc.boardTheme).toBe("brown");
    expect(doc.pieceSet).toBe("cburnett");
    expect(doc.lobbyColor).toBe("random");
    expect(doc.customMinIdx).toBe(7);
    expect(doc.customIncIdx).toBe(3);
    expect(doc.computerColor).toBe("white");
    expect(doc.puzzleRating).toBe(1500);
    expect(doc.puzzleCount).toBe(0);
    expect(doc.createdAt).toBeInstanceOf(Date);
    expect(doc.updatedAt).toBeInstanceOf(Date);
  });

  it("rejects duplicate userId", async () => {
    await UserPreferences.create({ userId: "bob-id" });

    await expect(UserPreferences.create({ userId: "bob-id" })).rejects.toThrow();
  });
});
