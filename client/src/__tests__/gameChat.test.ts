import { describe, it, expect, beforeEach } from "vitest";

interface ChatMessage {
  id: string;
  type: "player" | "system";
  sender?: string;
  text: string;
  timestamp: number;
}

let nextId = 0;
function addMessage(
  messages: ChatMessage[],
  data: Omit<ChatMessage, "id">
): ChatMessage[] {
  nextId += 1;
  return [...messages, { ...data, id: String(nextId) }];
}

function countUnread(
  messages: ChatMessage[],
  prevCount: number,
  playerName: string
): boolean {
  if (messages.length <= prevCount) return false;
  const newMsgs = messages.slice(prevCount);
  return newMsgs.some((m) => m.type === "player" && m.sender !== playerName);
}

function shouldShowChat(
  featureEnabled: boolean,
  isPlayer: boolean,
  status: string
): boolean {
  return featureEnabled && isPlayer && status !== "waiting";
}

describe("game chat state", () => {
  let messages: ChatMessage[];

  beforeEach(() => {
    messages = [];
    nextId = 0;
  });

  it("starts with an empty message list", () => {
    expect(messages).toHaveLength(0);
  });

  it("adds a player message", () => {
    messages = addMessage(messages, {
      type: "player",
      sender: "Alice",
      text: "hello",
      timestamp: 1000,
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]?.type).toBe("player");
    expect(messages[0]?.sender).toBe("Alice");
    expect(messages[0]?.text).toBe("hello");
  });

  it("adds a system message", () => {
    messages = addMessage(messages, {
      type: "system",
      text: "Game started — good luck!",
      timestamp: 1000,
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]?.type).toBe("system");
    expect(messages[0]?.sender).toBeUndefined();
  });

  it("assigns unique IDs to each message", () => {
    messages = addMessage(messages, {
      type: "player",
      sender: "Alice",
      text: "hi",
      timestamp: 1000,
    });
    messages = addMessage(messages, {
      type: "player",
      sender: "Bob",
      text: "hey",
      timestamp: 1001,
    });

    expect(messages[0]?.id).not.toBe(messages[1]?.id);
  });

  it("preserves message order", () => {
    messages = addMessage(messages, {
      type: "system",
      text: "Game started",
      timestamp: 1000,
    });
    messages = addMessage(messages, {
      type: "player",
      sender: "Alice",
      text: "gl",
      timestamp: 1001,
    });
    messages = addMessage(messages, {
      type: "player",
      sender: "Bob",
      text: "u2",
      timestamp: 1002,
    });

    expect(messages.map((m) => m.text)).toEqual(["Game started", "gl", "u2"]);
  });
});

describe("unread notification", () => {
  let messages: ChatMessage[];

  beforeEach(() => {
    messages = [];
    nextId = 0;
  });

  it("detects unread opponent message", () => {
    messages = addMessage(messages, {
      type: "player",
      sender: "Bob",
      text: "hi",
      timestamp: 1000,
    });

    expect(countUnread(messages, 0, "Alice")).toBe(true);
  });

  it("does not flag own message as unread", () => {
    messages = addMessage(messages, {
      type: "player",
      sender: "Alice",
      text: "hi",
      timestamp: 1000,
    });

    expect(countUnread(messages, 0, "Alice")).toBe(false);
  });

  it("does not flag system message as unread", () => {
    messages = addMessage(messages, {
      type: "system",
      text: "Game started",
      timestamp: 1000,
    });

    expect(countUnread(messages, 0, "Alice")).toBe(false);
  });

  it("no unread when message count has not changed", () => {
    messages = addMessage(messages, {
      type: "player",
      sender: "Bob",
      text: "hi",
      timestamp: 1000,
    });

    expect(countUnread(messages, 1, "Alice")).toBe(false);
  });

  it("detects unread among mixed new messages", () => {
    messages = addMessage(messages, {
      type: "system",
      text: "Game started",
      timestamp: 1000,
    });
    const prevCount = messages.length;

    messages = addMessage(messages, {
      type: "system",
      text: "Alice gave 15 seconds",
      timestamp: 1001,
    });
    messages = addMessage(messages, {
      type: "player",
      sender: "Bob",
      text: "thanks",
      timestamp: 1002,
    });

    expect(countUnread(messages, prevCount, "Alice")).toBe(true);
  });
});

describe("chat visibility", () => {
  it("shown when feature enabled, is player, and playing", () => {
    expect(shouldShowChat(true, true, "playing")).toBe(true);
  });

  it("shown when feature enabled, is player, and finished", () => {
    expect(shouldShowChat(true, true, "finished")).toBe(true);
  });

  it("hidden when waiting", () => {
    expect(shouldShowChat(true, true, "waiting")).toBe(false);
  });

  it("hidden when not a player", () => {
    expect(shouldShowChat(true, false, "playing")).toBe(false);
  });

  it("hidden when feature disabled", () => {
    expect(shouldShowChat(false, true, "playing")).toBe(false);
  });
});

interface ChatMessageData {
  type: "player" | "system";
  sender?: string;
  text: string;
  timestamp: number;
}

function loadChatFromRoom(
  serverMessages: ChatMessageData[] | undefined
): ChatMessage[] {
  if (!Array.isArray(serverMessages)) return [];
  return serverMessages.map((m, i) => ({ ...m, id: String(i + 1) }));
}

describe("chat persistence (load from room data)", () => {
  it("loads chat messages from room data on rejoin", () => {
    const serverData: ChatMessageData[] = [
      { type: "system", text: "Game started — good luck!", timestamp: 1000 },
      { type: "player", sender: "Alice", text: "gl", timestamp: 1001 },
      { type: "player", sender: "Bob", text: "u2", timestamp: 1002 },
    ];

    const loaded = loadChatFromRoom(serverData);

    expect(loaded).toHaveLength(3);
    expect(loaded[0]?.id).toBe("1");
    expect(loaded[0]?.type).toBe("system");
    expect(loaded[1]?.sender).toBe("Alice");
    expect(loaded[2]?.text).toBe("u2");
  });

  it("returns empty array for undefined chatMessages", () => {
    expect(loadChatFromRoom(undefined)).toEqual([]);
  });

  it("returns empty array for non-array chatMessages", () => {
    expect(loadChatFromRoom(null as unknown as undefined)).toEqual([]);
  });

  it("new messages after rejoin get sequential IDs", () => {
    const serverData: ChatMessageData[] = [
      { type: "system", text: "Game started", timestamp: 1000 },
    ];
    let messages = loadChatFromRoom(serverData);
    let nextIdCounter = messages.length;

    nextIdCounter += 1;
    messages = [...messages, { type: "player" as const, sender: "Alice", text: "hi", timestamp: 2000, id: String(nextIdCounter) }];

    expect(messages).toHaveLength(2);
    expect(messages[0]?.id).toBe("1");
    expect(messages[1]?.id).toBe("2");
  });
});
