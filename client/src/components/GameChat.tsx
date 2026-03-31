import { useState, useEffect, useRef, useCallback } from "react";
import type { ChatMessage } from "../types";
import { useI18n } from "../i18n/I18nProvider";
import { translateSystemChat } from "../i18n/systemChat";
import styles from "./GameChat.module.css";

interface Props {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  userId: string;
  displayName: string;
}

interface ChatLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_WIDTH = 280;
const MIN_HEIGHT = 250;
const MAX_WIDTH = 600;
const MAX_HEIGHT = 600;
const DEFAULT_WIDTH = 380;
const DEFAULT_HEIGHT = 440;
function clampLayout(l: ChatLayout): ChatLayout {
  const w = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, l.width));
  const h = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, l.height));
  const maxX = window.innerWidth - 60;
  const maxY = window.innerHeight - 40;
  return {
    width: w,
    height: h,
    x: Math.max(-w + 60, Math.min(maxX, l.x)),
    y: Math.max(0, Math.min(maxY, l.y)),
  };
}

function defaultLayout(): ChatLayout {
  return {
    x: window.innerWidth - DEFAULT_WIDTH - 16,
    y: window.innerHeight - DEFAULT_HEIGHT - 16,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  };
}

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
);

export default function GameChat(props: Props) {
  const { messages, onSend, displayName } = props;
  const { t, locale } = useI18n();
  const [isOpen, setIsOpen] = useState(true);
  const [hasUnread, setHasUnread] = useState(false);
  const [inputText, setInputText] = useState("");
  const [layout, setLayout] = useState<ChatLayout>(defaultLayout);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(messages.length);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const resizeRef = useRef<{
    startX: number;
    startY: number;
    origW: number;
    origH: number;
  } | null>(null);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (drag) {
        e.preventDefault();
        const newX = drag.origX + (e.clientX - drag.startX);
        const newY = drag.origY + (e.clientY - drag.startY);
        setLayout((prev) => clampLayout({ ...prev, x: newX, y: newY }));
      }
      const resize = resizeRef.current;
      if (resize) {
        e.preventDefault();
        const newW = resize.origW + (e.clientX - resize.startX);
        const newH = resize.origH + (e.clientY - resize.startY);
        setLayout((prev) => clampLayout({ ...prev, width: newW, height: newH }));
      }
    };

    const onMouseUp = () => {
      if (dragRef.current || resizeRef.current) {
        dragRef.current = null;
        resizeRef.current = null;
        /* layout kept in memory only */
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    if (!isOpen && messages.length > prevCountRef.current) {
      const newMsgs = messages.slice(prevCountRef.current);
      const hasOpponentMsg = newMsgs.some(
        (m) => m.type === "player" && m.sender !== displayName
      );
      if (hasOpponentMsg) setHasUnread(true);
    }
    prevCountRef.current = messages.length;
  }, [messages.length, isOpen, displayName, messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) setHasUnread(false);
      return !prev;
    });
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInputText("");
  }, [inputText, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: layoutRef.current.x,
        origY: layoutRef.current.y,
      };
    },
    []
  );

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origW: layoutRef.current.width,
        origH: layoutRef.current.height,
      };
    },
    []
  );

  if (!isOpen) {
    return (
      <button
        type="button"
        className={styles["toggleBtn"]}
        onClick={toggleOpen}
        title={t("chat.open")}
        data-tour="game-chat"
      >
        <ChatIcon />
        {hasUnread && <span className={styles["badge"]} />}
      </button>
    );
  }

  return (
    <div
      className={styles["panel"]}
      style={{
        top: layout.y,
        left: layout.x,
        width: layout.width,
        height: layout.height,
      }}
    >
      <div
        className={styles["header"]}
        onMouseDown={onDragStart}
      >
        <span className={styles["headerTitle"]}>{t("chat.title")}</span>
        <button
          type="button"
          className={styles["closeBtn"]}
          onClick={toggleOpen}
          title={t("chat.close")}
        >
          ✕
        </button>
      </div>

      <div className={styles["messages"]}>
        {messages.map((msg) =>
          msg.type === "system" ? (
            <div key={msg.id} className={styles["systemMsg"]}>
              {translateSystemChat(msg.text, locale, t)}
            </div>
          ) : (
            <div key={msg.id} className={styles["playerMsg"]}>
              <span
                className={
                  msg.sender === displayName
                    ? styles["senderSelf"]
                    : styles["senderOpponent"]
                }
              >
                {msg.sender ?? ""}:{" "}
              </span>
              {msg.text}
            </div>
          )
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles["inputRow"]}>
        <input
          className={styles["input"]}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("chat.placeholder")}
          maxLength={500}
        />
        <button
          type="button"
          className={styles["sendBtn"]}
          onClick={handleSend}
          disabled={!inputText.trim()}
          title={t("chat.send")}
        >
          <SendIcon />
        </button>
      </div>

      <div
        className={styles["resizeHandle"]}
        onMouseDown={onResizeStart}
      >
        <svg viewBox="0 0 14 14" width="14" height="14" fill="currentColor">
          <circle cx="9" cy="5" r="1.2" />
          <circle cx="5" cy="9" r="1.2" />
          <circle cx="9" cy="9" r="1.2" />
          <circle cx="13" cy="1" r="1.2" />
          <circle cx="13" cy="5" r="1.2" />
          <circle cx="13" cy="9" r="1.2" />
          <circle cx="1" cy="13" r="1.2" />
          <circle cx="5" cy="13" r="1.2" />
          <circle cx="9" cy="13" r="1.2" />
          <circle cx="13" cy="13" r="1.2" />
        </svg>
      </div>
    </div>
  );
}
