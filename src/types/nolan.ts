import { TobaccoGrade, SerialFactoryStatus } from './tobacco';

export interface NolanRecommendedIngredient {
  tobaccoId: string;
  tobaccoName: string;
  origin: string;
  usedNetKg: number;
  percentage: number;
  realCostPerNetKg: number;
  reason?: string;
}

export interface NolanRecommendedBlend {
  recipeName: string;
  targetFactory: string;
  targetGrade: TobaccoGrade;
  targetPricePerKg: number;
  totalNetKg: number;
  projectedHppPerKg: number;
  projectedProfitPerKg: number;
  estimatedSensory: {
    power: number;
    impact: number;
    bitter: number;
    burn: number;
    sugar: number;
    aroma: number;
  };
  reasoning: string;
  ingredients: NolanRecommendedIngredient[];
}

export type NolanNavTarget =
  | 'inventory'
  | 'inventory_rejected'
  | 'calculator'
  | 'rolls'
  | 'finished'
  | 'history'
  | 'settings'
  | 'simulator'
  | 'input_raw_modal'
  | 'google_sheets'
  | 'backup'
  | 'restore'
  | 'patch_notes';

export interface NolanPendingAction {
  id: string;
  type:
    | 'ADD_RAW_TOBACCO'
    | 'EDIT_RAW_TOBACCO'
    | 'UPDATE_FACTORY_STATUS'
    | 'APPLY_BLEND_RACIKAN';
  title: string;
  summary: string;
  status?: 'PENDING' | 'APPROVED' | 'CANCELLED' | 'pending' | 'approved' | 'cancelled';
  /** Payload for ADD_RAW_TOBACCO */
  newTobacco?: {
    name: string;
    origin: string;
    sellerName?: string;
    colorGrade: TobaccoGrade;
    grossWeightKg: number;
    netWeightKg?: number;
    pricePerKgPurchase: number;
    packagingType?: string;
    packagingMassKg?: number;
    taraPercent?: number;
    taraFlatKg?: number;
    powerRating?: number;
    impactRating?: number;
    bitterRating?: number;
    burnRating?: number;
    sugarRating?: number;
    aromaRating?: number;
    characterNotes?: string;
  };
  newRawTobacco?: {
    name: string;
    origin: string;
    sellerName?: string;
    colorGrade: TobaccoGrade;
    grossWeightKg: number;
    netWeightKg?: number;
    pricePerKgPurchase: number;
    packagingType?: string;
    packagingMassKg?: number;
    taraPercent?: number;
    taraFlatKg?: number;
    powerRating?: number;
    impactRating?: number;
    bitterRating?: number;
    burnRating?: number;
    sugarRating?: number;
    aromaRating?: number;
    characterNotes?: string;
  };
  /** Payload for EDIT_RAW_TOBACCO */
  editTobacco?: {
    tobaccoId: string;
    tobaccoName: string;
    updates: {
      name?: string;
      origin?: string;
      sellerName?: string;
      colorGrade?: TobaccoGrade;
      grossWeightKg?: number;
      currentStockNetKg?: number;
      pricePerKgPurchase?: number;
      realCostPerNetKg?: number;
      powerRating?: number;
      impactRating?: number;
      bitterRating?: number;
      burnRating?: number;
      sugarRating?: number;
      aromaRating?: number;
      characterNotes?: string;
    };
  };
  editRawTobacco?: {
    tobaccoId: string;
    tobaccoName: string;
    updates: {
      name?: string;
      origin?: string;
      sellerName?: string;
      colorGrade?: TobaccoGrade;
      grossWeightKg?: number;
      currentStockNetKg?: number;
      pricePerKgPurchase?: number;
      realCostPerNetKg?: number;
      powerRating?: number;
      impactRating?: number;
      bitterRating?: number;
      burnRating?: number;
      sugarRating?: number;
      aromaRating?: number;
      characterNotes?: string;
    };
  };
  /** Payload for UPDATE_FACTORY_STATUS */
  statusUpdate?: {
    serialId: string;
    serialNumber: string;
    newStatus: SerialFactoryStatus;
  };
  updateSerialStatus?: {
    serialId: string;
    serialNumber: string;
    factoryStatus: SerialFactoryStatus;
  };
  /** Payload for APPLY_BLEND_RACIKAN */
  blendToApply?: NolanRecommendedBlend;
}

export interface NolanDecisionEpisode {
  id: string;
  timestamp: string;
  type:
    | 'BLEND_CREATED'
    | 'FACTORY_ACCEPTED'
    | 'FACTORY_REJECTED'
    | 'RAW_PURCHASE'
    | 'USER_FEEDBACK';
  summary: string;
  factoryName?: string;
  recipeName?: string;
  grade?: string;
  hppPerKg?: number;
  targetPricePerKg?: number;
  ingredientsSummary?: string;
  learnedTakeaway: string;
}

export interface NolanFactoryPreference {
  factoryName: string;
  acceptedCount: number;
  rejectedCount: number;
  preferredGrades: string[];
  avgAcceptedHppPerKg: number;
  avgTargetPricePerKg: number;
  sensorySweetSpot: string;
  notes: string;
}

export interface NolanBrainMemory {
  agentName: string;
  version: string;
  accountEmail: string;
  lastUpdated: string;
  lastSyncedToGithub?: string;
  githubRepo: string;
  githubBranch: string;
  githubFilePath: string;
  autoSyncGithub: boolean;
  /** Core rules & heuristics Nolan has learned or been taught */
  learnedRules: string[];
  /** Historical decision episodes from the user's blending & QC actions */
  decisionEpisodes: NolanDecisionEpisode[];
  /** Per-factory learned profile */
  factoryProfiles: NolanFactoryPreference[];
}

export interface NolanChatMessage {
  id: string;
  role: 'user' | 'nolan';
  text: string;
  timestamp: string;
  recommendedBlend?: NolanRecommendedBlend | null;
  newLearnedRule?: string | null;
  navigateTo?: NolanNavTarget | null;
  pendingAction?: NolanPendingAction | null;
}

export interface GitHubConnectionStatus {
  connected: boolean;
  authMethod: 'oauth' | 'env_token' | 'none';
  username?: string;
  avatarUrl?: string;
  defaultRepo?: string;
  oauthConfigured: boolean;
}
