import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bot,
  Send,
  X,
  Minus,
  Brain,
  GitBranch,
  CheckCircle2,
  Scale,
  TrendingUp,
  Layers,
  Plus,
  Trash2,
  MessageCircle,
  CheckCheck,
  Maximize2,
  Minimize2,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Compass,
  ShieldCheck,
} from 'lucide-react';
import {
  RawTobacco,
  FinishedTobaccoSerial,
  TobaccoRollSample,
  PackagingMaster,
  FactoryMaster,
  BlendIngredient,
} from '../types/tobacco';
import {
  NolanBrainMemory,
  NolanChatMessage,
  NolanRecommendedBlend,
  GitHubConnectionStatus,
  NolanNavTarget,
  NolanPendingAction,
} from '../types/nolan';
import { runNolanSmartEngine, humanizeNolanText } from '../utils/nolanSmartEngine';
import { formatRupiah, clampRating5 } from '../utils/tobaccoMath';

interface NolanAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  userEmail: string | null;
  rawTobaccos: RawTobacco[];
  finishedBatches: FinishedTobaccoSerial[];
  rollSamples: TobaccoRollSample[];
  packagingList: PackagingMaster[];
  factoryList: FactoryMaster[];
  nolanBrain: NolanBrainMemory;
  onUpdateNolanBrain: (nextBrain: NolanBrainMemory) => void;
  onApplyRecommendedBlend: (ingredients: BlendIngredient[], recipeLabel: string) => void;
  onNavigate?: (target: NolanNavTarget) => void;
  onExecutePendingAction?: (action: NolanPendingAction) => void;
  onShowToast: (msg: string) => void;
  initialPrompt?: string | null;
  onClearInitialPrompt?: () => void;
  onOpenSettings?: () => void;
}

const GITHUB_TOKEN_SESSION_KEY = 'kretek_master_github_oauth_token';
const NOLAN_CHAT_HISTORY_KEY_PREFIX = 'kretek_master_nolan_chat_v1_';
const BUBBLE_SIZE = 58;
const EDGE_MARGIN = 12;

export const NolanAgentModal: React.FC<NolanAgentModalProps> = ({
  isOpen,
  onClose,
  onOpen,
  userEmail,
  rawTobaccos,
  finishedBatches,
  rollSamples,
  packagingList,
  factoryList,
  nolanBrain,
  onUpdateNolanBrain,
  onApplyRecommendedBlend,
  onNavigate,
  onExecutePendingAction,
  onShowToast,
  initialPrompt,
  onClearInitialPrompt,
  onOpenSettings,
}) => {
  const [activeSection, setActiveSection] = useState<'chat' | 'memory'>('chat');
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [newRuleText, setNewRuleText] = useState('');
  const [isExpandedWindow, setIsExpandedWindow] = useState(false);

  // Voice Command (SpeechRecognition id-ID) & Voice Readback (TTS)
  const [isListeningVoice, setIsListeningVoice] = useState(false);
  const [voiceSpeakEnabled, setVoiceSpeakEnabled] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Messenger-style Floating Bubble state
  const [isBubbleDismissed, setIsBubbleDismissed] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [bubbleSide, setBubbleSide] = useState<'left' | 'right'>('right');
  const [bubblePos, setBubblePos] = useState<{ x: number; y: number }>(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const h = typeof window !== 'undefined' ? window.innerHeight : 800;
    return {
      x: w - BUBBLE_SIZE - EDGE_MARGIN,
      y: Math.max(90, Math.min(h - 150, Math.round(h * 0.62))),
    };
  });
  const [isDraggingBubble, setIsDraggingBubble] = useState(false);
  const [isHoveringDeleteZone, setIsHoveringDeleteZone] = useState(false);

  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  // GitHub A-Brain state
  const [, setGhStatus] = useState<GitHubConnectionStatus>({
    connected: false,
    authMethod: 'none',
    oauthConfigured: false,
  });
  const [ghToken, setGhToken] = useState<string>(() => {
    try {
      return localStorage.getItem(GITHUB_TOKEN_SESSION_KEY) || '';
    } catch {
      return '';
    }
  });
  const [repoInput, setRepoInput] = useState<string>(
    nolanBrain.githubRepo && nolanBrain.githubRepo !== 'A-Brain'
      ? nolanBrain.githubRepo
      : 'Aldi-ang/A-Brain'
  );
  const [, setBranchInput] = useState<string>(nolanBrain.githubBranch || 'main');
  const [, setFilePathInput] = useState<string>(
    nolanBrain.githubFilePath && nolanBrain.githubFilePath !== 'nolan/tobacco-lab-brain.json'
      ? nolanBrain.githubFilePath
      : 'Tobacco-Business/nolan-brain.json'
  );

  const chatStorageKey = `${NOLAN_CHAT_HISTORY_KEY_PREFIX}${(
    userEmail || 'local_default'
  ).toLowerCase()}`;

  const [messages, setMessages] = useState<NolanChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(chatStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed
            .filter(
              (m: NolanChatMessage) =>
                !String(m?.text || '').includes('"code":503') &&
                !String(m?.text || '').includes('experiencing high demand') &&
                !String(m?.text || '').includes('Ringkasan Gudang & Barang Saat Ini (24/7 Live Engine)')
            )
            .map((m: NolanChatMessage) => ({
              ...m,
              text: m.role === 'nolan' ? humanizeNolanText(m.text) : m.text,
            }));
          if (cleaned.length > 0) return cleaned;
        }
      }
    } catch {
      // ignore
    }
    return [
      {
        id: 'nolan-welcome',
        role: 'nolan',
        text: humanizeNolanText(
          `Halo Bos! Saya Nolan 👋\nPartner racikan tembakau dan asisten operasional gudang untuk akun ${
            userEmail || 'Tobacco Lab'
          }.\n\n📦 Data aktif saat ini: ${rawTobaccos.length} bahan mentah dan ${
            finishedBatches.length
          } seri jadi terhubung otomatis ke memori A-Brain.\n\n🧭 Anda bisa suruh saya buka menu apa saja (otomatis), atau minta saya racik, tambah stok, dan edit data (dengan izin Anda). Bisa ketik atau tekan tombol mikrofon 🎙️ untuk perintah suara!`
        ),
        timestamp: new Date().toISOString(),
      },
    ];
  });

  const chatEndRef = useRef<HTMLDivElement>(null);

  const speakNolanReply = useCallback(
    (rawReply: string) => {
      if (!voiceSpeakEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
        return;
      }
      try {
        window.speechSynthesis.cancel();
        const cleanSpeech = humanizeNolanText(rawReply)
          .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}•]/gu, '')
          .slice(0, 360);
        const utter = new SpeechSynthesisUtterance(cleanSpeech);
        utter.lang = 'id-ID';
        utter.rate = 1.04;
        window.speechSynthesis.speak(utter);
      } catch {
        // ignore
      }
    },
    [voiceSpeakEnabled]
  );

  // Save chat messages to localStorage so active conversation persists
  useEffect(() => {
    try {
      localStorage.setItem(chatStorageKey, JSON.stringify(messages.slice(-40)));
    } catch {
      // ignore
    }
  }, [messages, chatStorageKey]);

  // Whenever the user explicitly opens Nolan, un-dismiss the bubble and clear unread badge
  useEffect(() => {
    if (isOpen) {
      setIsBubbleDismissed(false);
      setUnreadCount(0);
    }
  }, [isOpen]);

  // Auto-resolve any previously stuck/unanswered user message at the end of chat history
  useEffect(() => {
    if (isSending || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === 'user') {
      const smartResult = runNolanSmartEngine({
        message: lastMsg.text,
        rawTobaccos,
        finishedBatches,
        rollSamples,
        factoryList,
        nolanMemory: nolanBrain,
      });
      setMessages((prev) => {
        if (prev.length === 0 || prev[prev.length - 1].role !== 'user') return prev;
        return [
          ...prev,
          {
            id: `nolan-recovered-${Date.now()}`,
            role: 'nolan',
            text: humanizeNolanText(smartResult.replyMarkdown),
            timestamp: new Date().toISOString(),
            recommendedBlend: smartResult.recommendedBlend,
            newLearnedRule: smartResult.newLearnedRule,
            navigateTo: smartResult.navigateTo || null,
            pendingAction: smartResult.pendingAction || null,
          },
        ];
      });
    }
  }, [messages, isSending, rawTobaccos, finishedBatches, rollSamples, factoryList, nolanBrain]);

  // Keep bubble snapped to the screen edge on window resize
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setBubblePos((prev) => ({
        x: bubbleSide === 'left' ? EDGE_MARGIN : w - BUBBLE_SIZE - EDGE_MARGIN,
        y: Math.max(72, Math.min(h - BUBBLE_SIZE - 80, prev.y)),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [bubbleSide]);

  useEffect(() => {
    setRepoInput(
      nolanBrain.githubRepo && nolanBrain.githubRepo !== 'A-Brain'
        ? nolanBrain.githubRepo
        : 'Aldi-ang/A-Brain'
    );
    setBranchInput(nolanBrain.githubBranch || 'main');
    setFilePathInput(
      nolanBrain.githubFilePath && nolanBrain.githubFilePath !== 'nolan/tobacco-lab-brain.json'
        ? nolanBrain.githubFilePath
        : 'Tobacco-Business/nolan-brain.json'
    );
  }, [nolanBrain.githubRepo, nolanBrain.githubBranch, nolanBrain.githubFilePath]);

  const checkGitHubStatus = useCallback(
    async (tokenOverride?: string) => {
      try {
        const activeToken = tokenOverride !== undefined ? tokenOverride : ghToken;
        const res = await fetch('/api/github/status', {
          headers: activeToken ? { 'x-github-token': activeToken } : {},
        });
        if (!res.ok) return;
        const data = (await res.json()) as GitHubConnectionStatus;
        setGhStatus(data);

        if (
          data.connected &&
          data.username &&
          (!repoInput ||
            repoInput === 'A-Brain' ||
            !repoInput.includes('/') ||
            repoInput.toLowerCase().endsWith('/tobacco-lab'))
        ) {
          const autoRepo = data.defaultRepo || `${data.username}/A-Brain`;
          setRepoInput(autoRepo);
          onUpdateNolanBrain({
            ...nolanBrain,
            githubRepo: autoRepo,
            githubFilePath: 'Tobacco-Business/nolan-brain.json',
          });
        }
      } catch {
        // ignore
      }
    },
    [ghToken, nolanBrain, onUpdateNolanBrain, repoInput]
  );

  useEffect(() => {
    if (isOpen) {
      checkGitHubStatus();
    }
  }, [isOpen, checkGitHubStatus]);

  // Listen for OAuth popup success message
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (
        origin !== window.location.origin &&
        !origin.endsWith('.vercel.app') &&
        !origin.endsWith('.run.app') &&
        !origin.includes('localhost')
      ) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.provider === 'github') {
        const tokenFromPopup = event.data.token || '';
        if (tokenFromPopup) {
          setGhToken(tokenFromPopup);
          try {
            localStorage.setItem(GITHUB_TOKEN_SESSION_KEY, tokenFromPopup);
          } catch {
            // ignore
          }
        }
        checkGitHubStatus(tokenFromPopup);
        onShowToast('Akun GitHub berhasil terhubung ke Nolan (A-Brain)!');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [checkGitHubStatus, onShowToast]);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSending, isOpen]);

  const saveNewLearnedRuleToBrain = (ruleStrRaw: string, triggerText: string) => {
    const ruleStr = humanizeNolanText(String(ruleStrRaw || '').trim());
    if (!ruleStr || nolanBrain.learnedRules.includes(ruleStr)) return;
    const updatedBrain: NolanBrainMemory = {
      ...nolanBrain,
      lastUpdated: new Date().toISOString(),
      learnedRules: [ruleStr, ...nolanBrain.learnedRules],
      decisionEpisodes: [
        {
          id: `ep-chat-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'USER_FEEDBACK' as const,
          summary: `Instruksi / Preferensi dari Chat: "${triggerText.slice(0, 80)}"`,
          learnedTakeaway: ruleStr,
        },
        ...nolanBrain.decisionEpisodes,
      ].slice(0, 60),
    };
    onUpdateNolanBrain(updatedBrain);
  };

  const handleApprovePendingAction = (messageId: string, action: NolanPendingAction) => {
    if (onExecutePendingAction) {
      onExecutePendingAction(action);
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.pendingAction
          ? {
              ...m,
              pendingAction: {
                ...m.pendingAction,
                status: 'approved',
              },
            }
          : m
      )
    );
  };

  const handleCancelPendingAction = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId && m.pendingAction
          ? {
              ...m,
              pendingAction: {
                ...m.pendingAction,
                status: 'cancelled',
              },
            }
          : m
      )
    );
    onShowToast('Tindakan dibatalkan.');
  };

  const handleSendPrompt = async (customText?: string) => {
    const text = (customText ?? inputMessage).trim();
    if (!text || isSending) return;

    if (!customText) {
      setInputMessage('');
    }

    setIsBubbleDismissed(false);

    // Quick voice/text approval check: if user says "ya", "setuju", "izinkan", "terapkan", "gas", "oke terapkan"
    // and there is an unapproved pendingAction or recommendedBlend on the latest Nolan message, execute it immediately!
    const isDirectApproval =
      /^(ya|iya|setuju|izinkan|terapkan|gas|oke\s+terapkan|oke\s+setuju|lanjutkan|eksekusi|boleh|acc)$/i.test(
        text.replace(/[!.,?]/g, '').trim()
      );
    const lastNolanMsg = [...messages].reverse().find((m) => m.role === 'nolan');

    if (isDirectApproval && lastNolanMsg) {
      const pendingAct = lastNolanMsg.pendingAction;
      if (
        pendingAct &&
        (!pendingAct.status ||
          pendingAct.status === 'pending' ||
          pendingAct.status === 'PENDING')
      ) {
        handleApprovePendingAction(lastNolanMsg.id, pendingAct);
        setMessages((prev) => [
          ...prev,
          {
            id: `user-approve-${Date.now()}`,
            role: 'user',
            text,
            timestamp: new Date().toISOString(),
          },
          {
            id: `nolan-approved-${Date.now() + 1}`,
            role: 'nolan',
            text: `✅ Siap Bos! Sudah saya terapkan: ${pendingAct.title}.`,
            timestamp: new Date().toISOString(),
          },
        ]);
        return;
      }
      if (lastNolanMsg.recommendedBlend) {
        handleApplyBlendToCalculator(lastNolanMsg.recommendedBlend);
        return;
      }
    }

    const userMsg: NolanChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };

    // Prepare local fallback & instant navigation/action detector
    const smartResult = runNolanSmartEngine({
      message: text,
      rawTobaccos,
      finishedBatches,
      rollSamples,
      factoryList,
      nolanMemory: nolanBrain,
    });

    setMessages((prev) => [...prev, userMsg]);

    // If user asked for pure navigation (e.g., "buka racikan", "lihat stok jadi", "buka simulator"),
    // execute navigation immediately so the UI feels instant!
    if (smartResult.navigateTo && !smartResult.pendingAction && onNavigate) {
      onNavigate(smartResult.navigateTo);
      const navReply = humanizeNolanText(smartResult.replyMarkdown);
      setMessages((prev) => [
        ...prev,
        {
          id: `nolan-nav-${Date.now()}`,
          role: 'nolan',
          text: navReply,
          timestamp: new Date().toISOString(),
          navigateTo: smartResult.navigateTo,
        },
      ]);
      speakNolanReply(navReply);
      return;
    }

    // If user asked for a permission-gated data mutation (add/edit raw tobacco or update factory status),
    // show the permission card immediately!
    if (smartResult.pendingAction) {
      const actReply = humanizeNolanText(smartResult.replyMarkdown);
      setMessages((prev) => [
        ...prev,
        {
          id: `nolan-act-${Date.now()}`,
          role: 'nolan',
          text: actReply,
          timestamp: new Date().toISOString(),
          pendingAction: smartResult.pendingAction,
        },
      ]);
      speakNolanReply(actReply);
      return;
    }

    setIsSending(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12500);

    try {
      const response = await fetch('/api/nolan/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: text,
          history: messages.slice(-6).map((m) => ({ role: m.role, text: m.text })),
          accountData: {
            userEmail: userEmail || 'adikaryasukses99@gmail.com',
            rawTobaccos: rawTobaccos.slice(0, 30),
            finishedBatches: finishedBatches.slice(0, 20),
            rollSamples: rollSamples.slice(0, 15),
            packagingList: packagingList.slice(0, 15),
            factoryList: factoryList.slice(0, 15),
          },
          nolanMemory: nolanBrain,
        }),
      });
      clearTimeout(timeoutId);

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal mendapatkan respons dari Nolan.');
      }

      const cleanReply = humanizeNolanText(data.reply || smartResult.replyMarkdown);
      const navTarget = (data.navigateTo || smartResult.navigateTo || null) as NolanNavTarget | null;
      const pendingAct = (data.pendingAction || smartResult.pendingAction || null) as NolanPendingAction | null;

      if (navTarget && onNavigate) {
        onNavigate(navTarget);
      }

      const nolanReply: NolanChatMessage = {
        id: `nolan-${Date.now()}`,
        role: 'nolan',
        text: cleanReply,
        timestamp: new Date().toISOString(),
        recommendedBlend: data.recommendedBlend || smartResult.recommendedBlend || null,
        newLearnedRule: data.newLearnedRule ? humanizeNolanText(data.newLearnedRule) : null,
        navigateTo: navTarget,
        pendingAction: pendingAct,
      };

      setMessages((prev) => [...prev, nolanReply]);
      speakNolanReply(cleanReply);

      if (!isOpen) {
        setUnreadCount((c) => c + 1);
      }

      if (data.newLearnedRule) {
        saveNewLearnedRuleToBrain(data.newLearnedRule, text);
      }
    } catch {
      clearTimeout(timeoutId);
      const cleanFallback = humanizeNolanText(smartResult.replyMarkdown);
      if (smartResult.navigateTo && onNavigate) {
        onNavigate(smartResult.navigateTo);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `nolan-local-${Date.now()}`,
          role: 'nolan',
          text: cleanFallback,
          timestamp: new Date().toISOString(),
          recommendedBlend: smartResult.recommendedBlend,
          newLearnedRule: smartResult.newLearnedRule,
          navigateTo: smartResult.navigateTo || null,
          pendingAction: smartResult.pendingAction || null,
        },
      ]);
      speakNolanReply(cleanFallback);
      if (smartResult.newLearnedRule) {
        saveNewLearnedRuleToBrain(smartResult.newLearnedRule, text);
      }
    } finally {
      setIsSending(false);
    }
  };

  // Trigger initialPrompt automatically if opened from BlendCalculator
  useEffect(() => {
    if (isOpen && initialPrompt && !isSending) {
      setActiveSection('chat');
      const promptToRun = initialPrompt;
      if (onClearInitialPrompt) onClearInitialPrompt();
      handleSendPrompt(promptToRun);
    }
  }, [isOpen, initialPrompt]);

  // Voice Command Handler (Web Speech API id-ID)
  const handleToggleVoiceCommand = () => {
    if (isListeningVoice && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListeningVoice(false);
      return;
    }

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      onShowToast(
        'Browser ini belum mendukung pengenalan suara langsung. Gunakan Chrome atau Edge untuk fitur perintah suara.'
      );
      return;
    }

    try {
      const recognition = new SpeechRecognitionAPI();
      recognition.lang = 'id-ID';
      recognition.continuous = false;
      recognition.interimResults = true;

      let finalTranscript = '';

      recognition.onstart = () => {
        setIsListeningVoice(true);
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interim += transcript;
          }
        }
        setInputMessage((finalTranscript || interim).trim());
      };

      recognition.onerror = () => {
        setIsListeningVoice(false);
      };

      recognition.onend = () => {
        setIsListeningVoice(false);
        const spoken = finalTranscript.trim();
        if (spoken) {
          setInputMessage('');
          handleSendPrompt(spoken);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListeningVoice(false);
      onShowToast('Gagal mengaktifkan mikrofon. Pastikan izin mikrofon browser aktif.');
    }
  };

  // ============================================================================
  // MESSENGER FLOATING BUBBLE DRAG, EDGE-SNAP & MIDDLE-BOTTOM (X) DELETE LOGIC
  // ============================================================================
  const isPointInDeleteZone = (clientX: number, clientY: number) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const deleteCenterX = w / 2;
    const deleteCenterY = h - 56;
    const dist = Math.hypot(clientX - deleteCenterX, clientY - deleteCenterY);
    return dist <= 68;
  };

  const handleBubblePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      startX: bubblePos.x,
      startY: bubblePos.y,
      moved: false,
    };
  };

  const handleBubblePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.pointerX;
    const dy = e.clientY - dragStartRef.current.pointerY;

    if (Math.hypot(dx, dy) > 6) {
      dragStartRef.current.moved = true;
      if (!isDraggingBubble) {
        setIsDraggingBubble(true);
      }
    }

    if (dragStartRef.current.moved) {
      const nextX = dragStartRef.current.startX + dx;
      const nextY = dragStartRef.current.startY + dy;
      setBubblePos({ x: nextX, y: nextY });

      const bubbleCenterX = nextX + BUBBLE_SIZE / 2;
      const bubbleCenterY = nextY + BUBBLE_SIZE / 2;
      setIsHoveringDeleteZone(isPointInDeleteZone(bubbleCenterX, bubbleCenterY));
    }
  };

  const handleBubblePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragStartRef.current) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const wasDragged = dragStartRef.current.moved;
    dragStartRef.current = null;
    setIsDraggingBubble(false);

    if (!wasDragged) {
      // Simple tap on bubble -> toggle WhatsApp chatbox open/closed
      if (isOpen) {
        onClose();
      } else if (onOpen) {
        onOpen();
      }
      setIsHoveringDeleteZone(false);
      return;
    }

    const bubbleCenterX = bubblePos.x + BUBBLE_SIZE / 2;
    const bubbleCenterY = bubblePos.y + BUBBLE_SIZE / 2;

    // Check if dropped inside the middle-bottom (X) zone
    if (isPointInDeleteZone(bubbleCenterX, bubbleCenterY)) {
      setIsHoveringDeleteZone(false);
      setIsBubbleDismissed(true);
      if (isOpen) onClose();
      onShowToast('Gelembung chat Nolan ditutup. Klik ikon Nolan di atas kapan saja untuk membuka lagi.');
      return;
    }

    setIsHoveringDeleteZone(false);

    // Snap horizontally to the nearest screen edge (Left or Right ONLY)
    const w = window.innerWidth;
    const h = window.innerHeight;
    const snapSide: 'left' | 'right' = bubbleCenterX < w / 2 ? 'left' : 'right';
    const snappedX = snapSide === 'left' ? EDGE_MARGIN : w - BUBBLE_SIZE - EDGE_MARGIN;
    const clampedY = Math.max(70, Math.min(h - BUBBLE_SIZE - 80, bubblePos.y));

    setBubbleSide(snapSide);
    setBubblePos({ x: snappedX, y: clampedY });
  };

  const handleApplyBlendToCalculator = (blend: NolanRecommendedBlend) => {
    const mappedIngredients: BlendIngredient[] = blend.ingredients
      .map((rec) => {
        const raw = rawTobaccos.find((t) => t.id === rec.tobaccoId);
        if (!raw) return null;
        const safeKg = Math.min(rec.usedNetKg, raw.currentStockNetKg || rec.usedNetKg);
        return {
          tobaccoId: raw.id,
          tobaccoName: raw.name,
          origin: raw.origin,
          sellerName: raw.sellerName,
          usedNetKg: safeKg,
          percentageInBlend: rec.percentage,
          realCostPerNetKg: raw.realCostPerNetKg,
          effectiveCostPerRealKg: raw.effectiveCostPerRealKg ?? raw.realCostPerNetKg,
          subtotalCost: Math.round(safeKg * raw.realCostPerNetKg),
          powerRating: clampRating5(raw.powerRating),
          impactRating: clampRating5(raw.impactRating),
          bitterRating: clampRating5(raw.bitterRating),
          burnRating: clampRating5(raw.burnRating ?? 4.5),
          sugarRating: clampRating5(raw.sugarRating ?? 4.0),
          aromaRating: clampRating5(raw.aromaRating ?? 4.2),
          colorGrade: raw.colorGrade,
          characterNotes: raw.characterNotes,
        } as BlendIngredient;
      })
      .filter((x): x is BlendIngredient => x !== null);

    if (mappedIngredients.length === 0) {
      onShowToast('Bahan yang direkomendasikan tidak ditemukan di stok gudang saat ini.');
      return;
    }

    onApplyRecommendedBlend(mappedIngredients, blend.recipeName);
    onClose();
  };

  const handleAddManualRule = () => {
    const clean = newRuleText.trim();
    if (!clean) return;
    const nextBrain: NolanBrainMemory = {
      ...nolanBrain,
      lastUpdated: new Date().toISOString(),
      learnedRules: [clean, ...nolanBrain.learnedRules],
      decisionEpisodes: [
        {
          id: `manual-rule-${Date.now()}`,
          timestamp: new Date().toISOString(),
          type: 'USER_FEEDBACK' as const,
          summary: 'Aturan baru ditambahkan manual oleh pengguna',
          learnedTakeaway: clean,
        },
        ...nolanBrain.decisionEpisodes,
      ],
    };
    onUpdateNolanBrain(nextBrain);
    setNewRuleText('');
    onShowToast('Aturan racikan baru disimpan ke memori Nolan!');
  };

  const handleDeleteRule = (index: number) => {
    const nextRules = nolanBrain.learnedRules.filter((_, idx) => idx !== index);
    onUpdateNolanBrain({
      ...nolanBrain,
      lastUpdated: new Date().toISOString(),
      learnedRules: nextRules,
    });
  };

  const hasActiveConversation = messages.length >= 1;
  const showFloatingBubble = !isBubbleDismissed && hasActiveConversation;

  const lastMessagePreview = humanizeNolanText(messages[messages.length - 1]?.text || '').slice(
    0,
    58
  );

  return (
    <>
      {/* ========================================================================
          1. FACEBOOK MESSENGER-STYLE FLOATING CHAT HEAD BUBBLE (SNAPS TO EDGES)
          ======================================================================== */}
      {showFloatingBubble && (
        <motion.button
          type="button"
          onPointerDown={handleBubblePointerDown}
          onPointerMove={handleBubblePointerMove}
          onPointerUp={handleBubblePointerUp}
          animate={{
            left: bubblePos.x,
            top: bubblePos.y,
            scale: isHoveringDeleteZone ? 0.78 : isDraggingBubble ? 1.08 : 1,
          }}
          transition={
            isDraggingBubble
              ? { duration: 0 }
              : { type: 'spring', stiffness: 420, damping: 28 }
          }
          style={{
            width: BUBBLE_SIZE,
            height: BUBBLE_SIZE,
            touchAction: 'none',
          }}
          aria-label="Gelembung Chat Nolan AI (Geser ke tepi atau tarik ke X di bawah untuk menutup)"
          className={`fixed z-50 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing select-none shadow-[0_10px_30px_rgba(0,0,0,0.85)] border-2 transition-colors group ${
            isHoveringDeleteZone
              ? 'bg-rose-600 border-rose-300 text-white'
              : isOpen
                ? 'bg-amber-500 border-white text-black'
                : 'bg-[#071a14] border-emerald-400/90 text-emerald-300 hover:border-amber-400'
          }`}
        >
          <div className="relative flex items-center justify-center w-full h-full">
            <Bot className={`w-7 h-7 ${isOpen ? 'text-black' : 'text-amber-400'}`} />

            {/* Online Green Dot (WhatsApp/Messenger status) */}
            <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-black" />

            {/* Unread / Active Badge */}
            {(unreadCount > 0 || isSending) && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-black animate-bounce">
                {isSending ? '•••' : unreadCount}
              </span>
            )}
          </div>

          {/* Preview Tooltip on Hover when Chatbox is Minimized */}
          {!isOpen && !isDraggingBubble && (
            <div
              className={`pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute top-1/2 -translate-y-1/2 ${
                bubbleSide === 'right' ? 'right-16' : 'left-16'
              } w-56 px-3 py-2 rounded-2xl bg-[#071410] border border-emerald-500/50 text-left shadow-2xl`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold text-emerald-400 mb-0.5">
                <span>Nolan AI • Chat &amp; Suara</span>
                <MessageCircle className="w-3 h-3" />
              </div>
              <p className="text-[11px] text-zinc-200 line-clamp-2 leading-snug">
                {lastMessagePreview}...
              </p>
              <span className="block text-[9px] text-zinc-400 mt-1">
                Klik untuk buka • Tarik ke bawah (X) untuk hapus
              </span>
            </div>
          )}
        </motion.button>
      )}

      {/* ========================================================================
          2. MIDDLE-BOTTOM (X) DISMISS DROP TARGET WHEN DRAGGING BUBBLE
          ======================================================================== */}
      <AnimatePresence>
        {isDraggingBubble && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.8 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: isHoveringDeleteZone ? 1.22 : 1,
            }}
            exit={{ opacity: 0, y: 40, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center gap-1.5"
          >
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center border-2 shadow-[0_0_35px_rgba(0,0,0,0.95)] transition-colors ${
                isHoveringDeleteZone
                  ? 'bg-rose-600 border-white text-white shadow-[0_0_30px_rgba(225,29,72,0.8)]'
                  : 'bg-black/90 border-zinc-500 text-zinc-200'
              }`}
            >
              <X className="w-7 h-7 stroke-[2.5]" />
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                isHoveringDeleteZone
                  ? 'bg-rose-600 text-white border-rose-300'
                  : 'bg-black/90 text-zinc-300 border-zinc-700'
              }`}
            >
              {isHoveringDeleteZone ? 'Lepaskan untuk Hapus' : 'Tarik ke X untuk Tutup'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================
          3. WHATSAPP-STYLE FLOATING CHATBOX WINDOW
          ======================================================================== */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className={`fixed z-40 flex flex-col overflow-hidden rounded-2xl border-2 border-emerald-500/60 bg-[#0b141a] shadow-[0_24px_70px_rgba(0,0,0,0.95)] ${
              isExpandedWindow
                ? 'inset-3 sm:inset-6'
                : bubbleSide === 'left'
                  ? 'bottom-16 sm:bottom-6 left-3 sm:left-20 w-[calc(100vw-1.5rem)] sm:w-[430px] h-[78vh] sm:h-[630px] max-h-[86vh]'
                  : 'bottom-16 sm:bottom-6 right-3 sm:right-20 w-[calc(100vw-1.5rem)] sm:w-[430px] h-[78vh] sm:h-[630px] max-h-[86vh]'
            }`}
          >
            {/* WhatsApp Dark Green Top Header Bar */}
            <div className="px-3.5 py-2.5 bg-[#1f2c34] border-b border-zinc-800 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative w-10 h-10 rounded-full bg-[#00a884]/20 border border-[#00a884] flex items-center justify-center text-amber-400 shrink-0">
                  <Bot className="w-5 h-5" />
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00a884] border border-[#1f2c34]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-black text-white truncate">
                      Nolan AI (Tobacco Lab)
                    </h2>
                    <span className="px-1.5 py-0.5 rounded bg-[#00a884]/20 text-[#00a884] text-[9px] font-mono font-bold shrink-0">
                      Humanizer
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-300/90 truncate">
                    {isListeningVoice
                      ? '🎙️ Mendengarkan perintah suara Anda...'
                      : isSending
                        ? 'sedang menyiapkan jawaban...'
                        : `Online • Navigasi & Perintah Suara Aktif`}
                  </p>
                </div>
              </div>

              {/* Header Controls (TTS Voice Output, Expand, Minimize to Bubble, Close) */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const nextVal = !voiceSpeakEnabled;
                    setVoiceSpeakEnabled(nextVal);
                    if (!nextVal && typeof window !== 'undefined' && 'speechSynthesis' in window) {
                      window.speechSynthesis.cancel();
                    }
                    onShowToast(
                      nextVal
                        ? '🔊 Suara baca balasan Nolan diaktifkan.'
                        : '🔇 Suara baca balasan Nolan dimatikan.'
                    );
                  }}
                  title={
                    voiceSpeakEnabled
                      ? 'Matikan Suara Balasan Nolan'
                      : 'Aktifkan Suara Balasan Nolan (TTS Bahasa Indonesia)'
                  }
                  className={`h-8 w-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                    voiceSpeakEnabled
                      ? 'bg-[#00a884]/25 text-[#00a884] border border-[#00a884]/50'
                      : 'hover:bg-white/10 text-zinc-400 hover:text-white'
                  }`}
                >
                  {voiceSpeakEnabled ? (
                    <Volume2 className="w-4 h-4" />
                  ) : (
                    <VolumeX className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpandedWindow((prev) => !prev)}
                  title={isExpandedWindow ? 'Ukuran Chatbox Normal' : 'Perbesar Chatbox'}
                  className="h-8 w-8 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  {isExpandedWindow ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  title="Kecilkan ke Gelembung Chat (Messenger Bubble)"
                  className="h-8 w-8 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    setIsBubbleDismissed(true);
                  }}
                  title="Tutup Chat & Gelembung"
                  className="h-8 w-8 rounded-lg hover:bg-rose-500/20 text-zinc-300 hover:text-rose-400 flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Compact Sub-Navigation Bar (Chat | Memori) */}
            <div className="px-2.5 py-1.5 bg-[#111b21] border-b border-zinc-800/80 grid grid-cols-2 gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setActiveSection('chat')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  activeSection === 'chat'
                    ? 'bg-[#00a884] text-black shadow-sm'
                    : 'text-zinc-300 hover:bg-white/5'
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Chat &amp; Kontrol</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveSection('memory')}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  activeSection === 'memory'
                    ? 'bg-[#00a884] text-black shadow-sm'
                    : 'text-zinc-300 hover:bg-white/5'
                }`}
              >
                <Brain className="w-3.5 h-3.5 shrink-0" />
                <span>Memori ({nolanBrain.learnedRules.length})</span>
              </button>
            </div>

            {/* ====================================================================
                TAB 1: WHATSAPP CONVERSATION VIEW
                ==================================================================== */}
            {activeSection === 'chat' && (
              <div className="flex-1 flex flex-col min-h-0 bg-[#0b141a]">
                {/* WhatsApp Messages Scroll Container */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 bg-[radial-gradient(#1f2c34_1px,transparent_1px)] [background-size:16px_16px]">
                  {/* Encryption / A-Brain Info Banner */}
                  <div className="mx-auto max-w-xs px-3 py-1.5 rounded-xl bg-[#182229] border border-amber-500/25 text-center text-[10px] text-amber-200/90 leading-snug shadow-sm">
                    🧭 Navigasi halaman otomatis • 🛡️ Tambah/Edit data &amp; Racik butuh izin Anda • 🎙️ Suara aktif
                  </div>

                  {messages.map((msg) => {
                    const isUser = msg.role === 'user';
                    const timeStr = new Date(msg.timestamp).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const displayCleanText = isUser ? msg.text : humanizeNolanText(msg.text);

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`relative max-w-[88%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-md ${
                            isUser
                              ? 'bg-[#005c4b] text-white rounded-tr-xs'
                              : 'bg-[#202c33] text-zinc-100 rounded-tl-xs border border-zinc-700/60'
                          }`}
                        >
                          {!isUser && (
                            <div className="text-[10px] font-extrabold text-[#00a884] mb-0.5">
                              Nolan AI
                            </div>
                          )}

                          <div className="whitespace-pre-wrap break-words">{displayCleanText}</div>

                          {/* Autonomous Navigation Executed Badge */}
                          {msg.navigateTo && (
                            <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-[10px] text-emerald-300 flex items-center gap-1.5">
                              <Compass className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>
                                Navigasi otomatis dijalankan oleh Nolan
                              </span>
                            </div>
                          )}

                          {/* New Learned Rule Pill */}
                          {msg.newLearnedRule && (
                            <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-black/50 border border-amber-500/40 text-[10px] text-amber-300 flex items-center gap-1.5">
                              <Brain className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>
                                Disimpan ke A-Brain: {humanizeNolanText(msg.newLearnedRule)}
                              </span>
                            </div>
                          )}

                          {/* Permission-Gated Data Action Card (Add/Edit Stock or Factory Status) */}
                          {msg.pendingAction && (
                            <div className="mt-2.5 p-2.5 rounded-xl bg-[#111b21] border-2 border-amber-500/70 space-y-2">
                              <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                                  <span className="text-[9px] font-mono uppercase text-amber-400 font-bold">
                                    BUTUH IZIN ANDA (KONFIRMASI PERUBAHAN DATA)
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <h4 className="text-xs font-black text-white">
                                  {msg.pendingAction.title}
                                </h4>
                                <p className="text-[11px] text-zinc-300 leading-snug">
                                  {msg.pendingAction.summary}
                                </p>
                              </div>

                              {!msg.pendingAction.status ||
                              msg.pendingAction.status === 'pending' ||
                              msg.pendingAction.status === 'PENDING' ? (
                                <div className="grid grid-cols-2 gap-1.5 pt-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleApprovePendingAction(msg.id, msg.pendingAction!)
                                    }
                                    className="py-2 px-2.5 rounded-lg bg-[#00a884] hover:bg-[#00a884]/90 text-black font-black text-[11px] flex items-center justify-center gap-1 cursor-pointer shadow-md"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Izinkan &amp; Terapkan</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCancelPendingAction(msg.id)}
                                    className="py-2 px-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>Batalkan</span>
                                  </button>
                                </div>
                              ) : msg.pendingAction.status === 'approved' ||
                                msg.pendingAction.status === 'APPROVED' ? (
                                <div className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-[10px] font-extrabold flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span>Sudah Diizinkan &amp; Diterapkan ke Gudang</span>
                                </div>
                              ) : (
                                <div className="px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-400 text-[10px] font-bold">
                                  Tindakan dibatalkan oleh pengguna
                                </div>
                              )}
                            </div>
                          )}

                          {/* Embedded Recommended Blend Card inside WhatsApp Message (Requires User Permission Click) */}
                          {msg.recommendedBlend && (
                            <div className="mt-2.5 p-2.5 rounded-xl bg-[#111b21] border border-amber-500/60 space-y-2">
                              <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-1.5">
                                <div>
                                  <span className="text-[9px] font-mono uppercase text-amber-400 font-bold block">
                                    DRAF RACIKAN NOLAN • MENUNGGU IZIN ANDA
                                  </span>
                                  <h4 className="text-xs font-black text-white">
                                    {msg.recommendedBlend.recipeName} [
                                    {msg.recommendedBlend.targetGrade}]
                                  </h4>
                                  <p className="text-[10px] text-zinc-400">
                                    Pabrik: <b className="text-white">{msg.recommendedBlend.targetFactory}</b>
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                                <div className="p-1.5 rounded bg-black/60 border border-zinc-800">
                                  <span className="text-zinc-400 block text-[9px]">TOTAL &amp; HPP/KG</span>
                                  <b className="text-white">
                                    {msg.recommendedBlend.totalNetKg} kg •{' '}
                                    {formatRupiah(msg.recommendedBlend.projectedHppPerKg)}
                                  </b>
                                </div>
                                <div className="p-1.5 rounded bg-black/60 border border-zinc-800">
                                  <span className="text-zinc-400 block text-[9px]">PROFIT/KG</span>
                                  <b className="text-emerald-400">
                                    +{formatRupiah(msg.recommendedBlend.projectedProfitPerKg)}
                                  </b>
                                </div>
                              </div>

                              <div className="space-y-1">
                                {msg.recommendedBlend.ingredients.map((ing, i) => (
                                  <div
                                    key={`${ing.tobaccoId}-${i}`}
                                    className="px-2 py-1 rounded bg-black/50 border border-zinc-800/80 flex items-center justify-between gap-2 text-[10px] font-mono"
                                  >
                                    <span className="truncate text-white font-bold">
                                      {ing.tobaccoName}
                                    </span>
                                    <span className="text-amber-400 shrink-0 font-bold">
                                      {ing.usedNetKg} kg ({ing.percentage}%)
                                    </span>
                                  </div>
                                ))}
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  handleApplyBlendToCalculator(msg.recommendedBlend!)
                                }
                                className="w-full py-2 px-3 rounded-lg bg-[#00a884] hover:bg-[#00a884]/90 text-black font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Izinkan &amp; Terapkan ke Kalkulator Racikan</span>
                              </button>
                            </div>
                          )}

                          {/* WhatsApp Timestamp & Double Tick */}
                          <div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-zinc-300/80">
                            <span>{timeStr}</span>
                            {isUser && <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* WhatsApp Typing Bubble */}
                  {isSending && (
                    <div className="flex items-start">
                      <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-xs bg-[#202c33] border border-zinc-700/60 text-xs text-emerald-300 flex items-center gap-2">
                        <span className="flex gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-bounce" />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-bounce [animation-delay:150ms]" />
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-bounce [animation-delay:300ms]" />
                        </span>
                        <span className="text-[11px] text-zinc-300">
                          Nolan sedang menghitung...
                        </span>
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* Quick Prompt Chips Row (Scrollable horizontally above WhatsApp Input) */}
                <div className="px-2.5 py-1.5 bg-[#111b21] border-t border-zinc-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() =>
                      handleSendPrompt(
                        'Nolan, rekomendasikan komposisi racikan terbaik dari sisa stok tembakau mentah saat ini supaya HPP efisien dan profit maksimal.'
                      )
                    }
                    className="px-2.5 py-1 rounded-full bg-[#202c33] hover:bg-[#2a3942] border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <Scale className="w-3 h-3 text-[#00a884]" />
                    <span>Racikan Terbaik</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() =>
                      handleSendPrompt(
                        'Berikan laporan cepat Total Modal Gudang, Weight Profit (Rp & KG), serta status seri pabrik saat ini.'
                      )
                    }
                    className="px-2.5 py-1 rounded-full bg-[#202c33] hover:bg-[#2a3942] border border-zinc-700 text-zinc-200 text-[10px] font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <TrendingUp className="w-3 h-3 text-amber-400" />
                    <span>Cek Profit &amp; Status</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() =>
                      handleSendPrompt(
                        'Analisis sisa stok tembakau mentah saat ini dan mana yang memiliki Weight Profit tertinggi.'
                      )
                    }
                    className="px-2.5 py-1 rounded-full bg-[#202c33] hover:bg-[#2a3942] border border-zinc-700 text-zinc-200 text-[10px] font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <Layers className="w-3 h-3 text-sky-400" />
                    <span>Cek Stok Gudang</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => handleSendPrompt('Buka menu Kalkulator Racikan')}
                    className="px-2.5 py-1 rounded-full bg-[#202c33] hover:bg-[#2a3942] border border-zinc-700 text-zinc-200 text-[10px] font-bold flex items-center gap-1 whitespace-nowrap cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <Compass className="w-3 h-3 text-emerald-400" />
                    <span>Buka Racikan</span>
                  </button>
                </div>

                {/* WhatsApp Bottom Input Bar with Voice Command Button */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendPrompt();
                  }}
                  className="p-2 bg-[#1f2c34] flex items-center gap-1.5 shrink-0"
                >
                  <button
                    type="button"
                    onClick={handleToggleVoiceCommand}
                    title={
                      isListeningVoice
                        ? 'Hentikan rekaman suara'
                        : 'Bicara ke Nolan (Perintah Suara Bahasa Indonesia)'
                    }
                    aria-label="Perintah Suara Bahasa Indonesia"
                    className={`w-9 h-9 rounded-full flex items-center justify-center cursor-pointer shrink-0 transition-all shadow-md ${
                      isListeningVoice
                        ? 'bg-rose-600 text-white border-2 border-white animate-pulse'
                        : 'bg-[#2a3942] hover:bg-[#364852] text-amber-400 border border-amber-500/40'
                    }`}
                  >
                    {isListeningVoice ? (
                      <MicOff className="w-4 h-4 stroke-[2.4]" />
                    ) : (
                      <Mic className="w-4 h-4 stroke-[2.4]" />
                    )}
                  </button>

                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder={
                      isListeningVoice
                        ? '🎙️ Silakan bicara (misal: "buka racikan" atau "cek stok")...'
                        : 'Ketik atau klik 🎙️ bicara ke Nolan...'
                    }
                    className="flex-1 h-9 px-3.5 rounded-full bg-[#2a3942] text-xs text-white placeholder:text-zinc-400 focus:outline-hidden border border-transparent focus:border-[#00a884]"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !inputMessage.trim()}
                    aria-label="Kirim Pesan"
                    className="w-9 h-9 rounded-full bg-[#00a884] hover:bg-[#00a884]/90 text-black flex items-center justify-center cursor-pointer disabled:opacity-40 shrink-0 shadow-md"
                  >
                    <Send className="w-4 h-4 stroke-[2.4]" />
                  </button>
                </form>
              </div>
            )}

            {/* ====================================================================
                TAB 2: NOLAN SELF-LEARNING MEMORY
                ==================================================================== */}
            {activeSection === 'memory' && (
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-[#0b141a] text-xs">
                <div className="p-3 rounded-xl bg-[#111b21] border border-zinc-800 space-y-2.5">
                  <h3 className="text-xs font-black uppercase text-white flex items-center gap-1.5">
                    <Brain className="w-4 h-4 text-[#00a884]" />
                    <span>Aturan Racikan yang Dipelajari Nolan</span>
                  </h3>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newRuleText}
                      onChange={(e) => setNewRuleText(e.target.value)}
                      placeholder="Tambah aturan racikan baru..."
                      className="flex-1 h-8 px-2.5 rounded-lg bg-[#202c33] border border-zinc-700 text-xs text-white placeholder:text-zinc-500 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={handleAddManualRule}
                      className="px-2.5 h-8 rounded-lg bg-[#00a884] text-black font-black text-[11px] flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Simpan</span>
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {nolanBrain.learnedRules.map((rule, idx) => (
                      <div
                        key={idx}
                        className="px-2.5 py-1.5 rounded-lg bg-[#202c33] border border-zinc-800 flex items-center justify-between gap-2 text-[11px] text-zinc-200"
                      >
                        <span>
                          <b className="text-[#00a884] mr-1">{idx + 1}.</b>
                          {rule}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(idx)}
                          className="text-zinc-400 hover:text-rose-400 p-1 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#111b21] border border-zinc-800 space-y-2">
                  <h3 className="text-xs font-black uppercase text-white">
                    Log Keputusan Otomatis ({nolanBrain.decisionEpisodes.length})
                  </h3>
                  <div className="space-y-1.5 max-h-52 overflow-y-auto">
                    {nolanBrain.decisionEpisodes.map((ep) => (
                      <div
                        key={ep.id}
                        className="p-2 rounded-lg bg-[#202c33] border border-zinc-800 text-[11px] space-y-0.5"
                      >
                        <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400">
                          <span className="text-[#00a884] font-bold">{ep.type}</span>
                          <span>{ep.timestamp.slice(0, 16).replace('T', ' ')}</span>
                        </div>
                        <p className="font-bold text-white">{ep.summary}</p>
                        <p className="text-[10px] text-zinc-300">{ep.learnedTakeaway}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenSettings();
                      onClose();
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-[#111b21] hover:bg-[#1f2c34] border border-zinc-800 text-zinc-300 hover:text-white text-[11px] font-extrabold flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-[#00a884]" />
                      <span>Pengaturan Koneksi GitHub A-Brain ({nolanBrain.githubRepo || 'Aldi-ang/A-Brain'})</span>
                    </span>
                    <span className="text-[#00a884]">Buka Setting →</span>
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
