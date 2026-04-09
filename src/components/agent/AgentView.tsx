import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useAgentCenterStore } from "@/stores";
import { useLayoutStore } from "@/stores";
import {
  useCodexStore,
  useApprovalStore,
  useRequestUserInputStore,
} from "@/stores/codex";
import { useCCStore } from "@/stores/cc";
import { useWorkspaceStore } from "@/stores/useWorkspaceStore";
import { codexService } from "@/services/codexService";
import { gitRemoveWorktree } from "@/services/tauri/git";
import {
  ArrowLeft,
  X,
  Maximize2,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import type { AgentCenterCard } from "@/stores/useAgentCenterStore";
import { AgentIcon } from "@/components/common/AgentIcon";
import { AgentComposer } from "@/components/agent";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodexCard } from "./CodexCard";
import { CCCard } from "./CCCard";

const ChatInterface = lazy(() =>
  import("@/components/codex/ChatInterface").then((m) => ({
    default: m.ChatInterface,
  })),
);
const CCView = lazy(() => import("@/components/cc/CCView"));

// CardHeader

type CardStatus = "running" | "pending" | "idle";

interface CardHeaderProps {
  card: AgentCenterCard;
  onClose?: () => void;
  onBack?: () => void;
  onSelect?: () => void;
  onExpand?: () => void;
  status?: CardStatus;
}

export function CardHeader({
  card,
  onClose,
  onBack,
  onSelect,
  onExpand,
  status = "idle",
}: CardHeaderProps) {
  const title = card.preview?.slice(0, 60) || card.id.slice(0, 12);

  const dotColor =
    status === "running"
      ? "bg-green-500"
      : status === "pending"
        ? "bg-amber-500"
        : "bg-muted-foreground/40";

  const dotAnimate = status !== "idle" ? "animate-pulse" : "";

  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 border-b bg-muted/30 shrink-0"
      onClick={onSelect}
      style={onSelect ? { cursor: "pointer" } : undefined}
    >
      {onBack && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBack();
          }}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
      )}
      {onClose && (
        // Shows a status dot by default; reveals the X button on hover.
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="group relative h-3.5 w-3.5 flex items-center justify-center shrink-0"
          aria-label="Remove"
        >
          <span
            className={`absolute h-2 w-2 rounded-full transition-opacity duration-150 group-hover:opacity-0 ${dotColor} ${dotAnimate}`}
          />
          <X className="h-3.5 w-3.5 text-destructive/60 hover:text-destructive absolute opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
        </button>
      )}
      <AgentIcon agent={card.kind} />
      <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
        {title}
      </span>
      {onExpand && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Expand"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

interface AgentCardProps {
  card: AgentCenterCard;
  onExpand: () => void;
  onRemove: () => void;
  isSelected: boolean;
}

function AgentCard({ card, onExpand, onRemove, isSelected }: AgentCardProps) {
  const { setCurrentAgentCardId } = useAgentCenterStore();
  const { sessionLoadingMap, sessionMessagesMap, activeSessionIds } =
    useCCStore();
  const { threadStatusMap } = useCodexStore();
  const { pendingApprovals } = useApprovalStore();
  const { pendingRequests } = useRequestUserInputStore();
  const codexStatus =
    card.kind === "codex" ? threadStatusMap[card.id] : undefined;
  const running =
    card.kind === "codex"
      ? codexStatus?.type === "active" && codexStatus.activeFlags.length === 0
      : activeSessionIds.includes(card.id) && !!sessionLoadingMap[card.id];

  const pending =
    card.kind === "codex"
      ? codexStatus?.type === "active" && codexStatus.activeFlags.length > 0
      : (sessionMessagesMap[card.id] ?? []).some(
        (m) => m.type === "permission_request" && !(m as any).resolved,
      ) ||
      pendingApprovals.some((a) => (a as any).threadId === card.id) ||
      pendingRequests.some((r) => r.threadId === card.id);

  const status: CardStatus = running ? "running" : pending ? "pending" : "idle";

  const header = (
    <CardHeader
      card={card}
      onClose={onRemove}
      onSelect={() => {
        setCurrentAgentCardId(card.id);
        if (card.kind === "codex") void codexService.setCurrentThread(card.id);
      }}
      onExpand={onExpand}
      status={status}
    />
  );

  if (card.kind === "codex") {
    return (
      <CodexCard
        card={card as AgentCenterCard & { kind: "codex" }}
        onRemove={onRemove}
        header={header}
        isSelected={isSelected}
      />
    );
  }

  return (
    <CCCard
      card={card as AgentCenterCard & { kind: "cc" }}
      onRemove={onRemove}
      header={header}
      isSelected={isSelected}
    />
  );
}

function AgentFullscreen() {
  const { cards, currentAgentCardId } = useAgentCenterStore();
  const { setIsAgentExpanded } = useLayoutStore();
  const { selectedAgent } = useWorkspaceStore();

  const card = cards.find((c) => c.id === currentAgentCardId);
  // Fallback for new thread/session (no card yet): show blank header with correct agent kind
  const headerCard: AgentCenterCard = card ?? { kind: selectedAgent, id: "" };

  return (
    <div className="flex flex-col h-full min-h-0">
      <CardHeader card={headerCard} onBack={() => setIsAgentExpanded(false)} />
      <div className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
        <Suspense fallback={null}>
          {selectedAgent === "codex" ? <ChatInterface /> : <CCView />}
        </Suspense>
      </div>
    </div>
  );
}

// ─── ColumnLabel ────────────────────────────────────────────────────────────

function ColumnLabel({
  dot,
  label,
  count,
}: {
  dot?: "green" | "muted";
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 border-b shrink-0 bg-muted/20">
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${dot === "green" ? "bg-green-500" : "bg-muted-foreground/40"}`}
        />
      )}
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <span className="text-[10px] text-muted-foreground/50 ml-auto">
        {count}
      </span>
    </div>
  );
}

// ─── AgentList ────────────────────────────────────────────────────────────────

function AgentList() {
  const { cards, removeCard, setCurrentAgentCardId, currentAgentCardId } =
    useAgentCenterStore();
  const { setIsAgentExpanded } = useLayoutStore();
  const {
    switchToSession,
    sessionLoadingMap,
    activeSessionId,
    setActiveSessionId,
  } = useCCStore();
  const { threadStatusMap, currentThreadId } = useCodexStore();
  const { setSelectedAgent, selectedAgent } = useWorkspaceStore();

  const isRunning = (card: AgentCenterCard) =>
    card.kind === "codex"
      ? threadStatusMap[card.id]?.type === "active"
      : !!sessionLoadingMap[card.id];

  const handleRemove = (card: AgentCenterCard) => {
    removeCard(card);
    if (card.id === currentAgentCardId) {
      setCurrentAgentCardId(null);
    }
    if (card.kind === "codex") {
      if (card.id === currentThreadId) {
        void codexService.setCurrentThread(null);
      }
    } else {
      if (card.id === activeSessionId) {
        setActiveSessionId(null);
      }
    }
    if (card.worktreePath) {
      const { cwd } = useWorkspaceStore.getState();
      const worktreeKey = card.worktreePath.split("/").pop() ?? "";
      if (cwd && worktreeKey) {
        void gitRemoveWorktree(cwd, worktreeKey);
      }
    }
  };

  const expand = async (card: AgentCenterCard) => {
    setCurrentAgentCardId(card.id);
    setSelectedAgent(card.kind);
    setIsAgentExpanded(true);
    if (card.kind === "codex") {
      await codexService.setCurrentThread(card.id);
    } else {
      switchToSession(card.id);
    }
  };

  const selectCard = (card: AgentCenterCard) => {
    setCurrentAgentCardId(card.id);
    setSelectedAgent(card.kind);
    if (card.kind === "codex") void codexService.setCurrentThread(card.id);
    else switchToSession(card.id);
  };

  const [showSidePanels, setShowSidePanels] = useState(true);
  const [mobileTab, setMobileTab] = useState<"all" | "idle" | "running">("all");
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.matchMedia("(min-width: 768px)").matches;
  });
  // On mobile, track the visual viewport so the container stays pinned to the
  // visible area when the on-screen keyboard appears (iOS WKWebView scrolls the
  // document on input focus, which hides the composer behind the keyboard).
  const [mobileVP, setMobileVP] = useState<{
    top: number;
    height: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(min-width: 768px)");
    const handleChange = (event: MediaQueryListEvent) =>
      setIsDesktop(event.matches);
    setIsDesktop(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (isDesktop) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () =>
      setMobileVP({ top: vv.offsetTop, height: vv.height, width: vv.width });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [isDesktop]);

  const runningCards = useMemo(
    () => cards.filter((c) => isRunning(c)),
    [cards, threadStatusMap, sessionLoadingMap],
  );

  const idleCards = useMemo(
    () => cards.filter((c) => !isRunning(c)),
    [cards, threadStatusMap, sessionLoadingMap],
  );

  const mobileCards = useMemo(() => {
    if (mobileTab === "running") return runningCards;
    if (mobileTab === "idle") return idleCards;
    return cards;
  }, [cards, idleCards, mobileTab, runningCards]);

  if (!isDesktop) {
    return (
      <div
        className="flex flex-col overflow-hidden bg-background"
        style={
          mobileVP
            ? {
                position: "fixed",
                top: mobileVP.top,
                left: 0,
                width: mobileVP.width,
                height: mobileVP.height,
              }
            : { height: "100%" }
        }
      >
        <Tabs
          value={mobileTab}
          onValueChange={(value) =>
            setMobileTab(value as "all" | "idle" | "running")
          }
          className="w-full"
        >
          <TabsList className="flex h-auto w-full">
            <TabsTrigger value="all" className="flex-1 text-xs">
              All {cards.length}
            </TabsTrigger>
            <TabsTrigger
              value="idle"
              className="flex-1 text-xs flex items-center justify-center gap-1"
            >
              <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-muted-foreground/40" />
              Idle {idleCards.length}
            </TabsTrigger>
            <TabsTrigger
              value="running"
              className="flex-1 text-xs flex items-center justify-center gap-1"
            >
              <span className="h-1.5 w-1.5 rounded-full shrink-0 bg-green-500" />
              Running {runningCards.length}
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex-1 min-h-0 overflow-y-auto p-3">
          {mobileCards.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No {mobileTab} agents.
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {mobileCards.map((card) => (
                <div key={card.id} className="w-full sm:w-[320px] flex-grow">
                  <AgentCard
                    key={card.id}
                    card={card}
                    onExpand={() => void expand(card)}
                    onRemove={() => handleRemove(card)}
                    isSelected={card.id === currentAgentCardId}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-center shrink-0">
          <div className="w-full max-w-3xl px-2">
            <AgentComposer />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-row h-full min-h-0 overflow-hidden">
      {/* Left: current session */}
      <div className="flex-1 flex flex-col min-h-0 border-r overflow-hidden">
        <div className="flex justify-end px-1 pt-1 shrink-0">
          <button
            onClick={() => setShowSidePanels((v) => !v)}
            className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            aria-label={
              showSidePanels ? "Hide side panels" : "Show side panels"
            }
          >
            {showSidePanels ? (
              <PanelRightClose className="h-3.5 w-3.5" />
            ) : (
              <PanelRightOpen className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <Suspense fallback={null}>
            {selectedAgent === "codex" ? (
              <ChatInterface hideComposer />
            ) : (
              <CCView hideComposer />
            )}
          </Suspense>
        </div>
        <div className="shrink-0 flex justify-center">
          <div className="w-full px-2 md:max-w-3xl md:px-0">
            <AgentComposer />
          </div>
        </div>
      </div>

      {showSidePanels && (
        <>
          {/* Middle: running */}
          <div className="w-80 flex-none flex flex-col min-h-0 border-r overflow-hidden">
            <ColumnLabel
              dot="green"
              label="Running"
              count={runningCards.length}
            />
            <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-2">
              {runningCards.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground/50 py-4">
                  No running agents
                </div>
              ) : (
                runningCards.map((card) => (
                  <div
                    key={card.id}
                    onClick={() => selectCard(card)}
                    className="cursor-pointer"
                  >
                    <AgentCard
                      card={card}
                      onExpand={() => void expand(card)}
                      onRemove={() => handleRemove(card)}
                      isSelected={card.id === currentAgentCardId}
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: idle */}
          <div className="w-80 flex-none flex flex-col min-h-0 overflow-hidden">
            <ColumnLabel dot="muted" label="Idle" count={idleCards.length} />
            <div className="flex-1 min-h-0 overflow-y-auto p-2 flex flex-col gap-2">
              {idleCards.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground/50 py-4">
                  No idle agents
                </div>
              ) : (
                idleCards.map((card) => (
                  <div
                    key={card.id}
                    onClick={() => selectCard(card)}
                    className="cursor-pointer"
                  >
                    <AgentCard
                      card={card}
                      onExpand={() => void expand(card)}
                      onRemove={() => handleRemove(card)}
                      isSelected={card.id === currentAgentCardId}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function AgentView() {
  const { isAgentExpanded } = useLayoutStore();
  return isAgentExpanded ? <AgentFullscreen /> : <AgentList />;
}
