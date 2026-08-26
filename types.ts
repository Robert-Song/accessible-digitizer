
export type LanguageLevel = 'faithful' | 'natural' | 'fleshed_out';

export interface Figure {
  id: string;
  box_2d: [number, number, number, number]; // [ymin, xmin, ymax, xmax]
  alt: string;
}

export interface ModelPageResponse {
  html: string;
  figures: Figure[];
}

export type GeminiPageResponse = ModelPageResponse;

export interface BatchResponse {
  pages: ModelPageResponse[];
  tokenCount: number;
}

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export interface AccessibilityAudit {
  score: number;
  passed: boolean;
  tool: string;
  standard: string;
  checks: {
    title: string;
    passed: boolean;
    description: string;
    suggestion?: string;
  }[];
  violations: AccessibilityViolation[];
  incomplete: AccessibilityViolation[];
  manualReview: string[];
}

export interface AccessibilityViolationNode {
  target: string[];
  html: string;
  failureSummary?: string;
}

export interface AccessibilityViolation {
  id: string;
  impact?: string;
  description: string;
  help: string;
  helpUrl?: string;
  tags: string[];
  nodes: AccessibilityViolationNode[];
}

export interface FigureResult {
  id: string;
  originalSrc: string;
  currentSrc: string;
  alt: string;
}

export interface ConversionResult {
  html: string;
  pageNumber: number;
  width: number;
  height: number;
  audit?: AccessibilityAudit;
  figures: FigureResult[];
}

export interface DigitizationOptions {
  languageLevel: LanguageLevel;
  generateDocSummary?: boolean;
  topicKeyword?: string;
  concurrencyLimit?: number;
}

export type PageProcessingStatus = 'pending' | 'converting' | 'cropping' | 'auditing' | 'repairing' | 'completed' | 'error';

export interface PageProgressInfo {
  pageNumber: number;
  status: PageProcessingStatus;
  statusMessage?: string;
  error?: string;
}

export interface AppState {
  isProcessing: boolean;
  progress: number;
  results: ConversionResult[];
  error: string | null;
  statusMessage: string;
  totalTime?: number;
  sessionRequestCount: number;
  dailyRequestCount: number;
  docSummary?: string | null;
  topicKeyword?: string | null;
  pageProgress?: PageProgressInfo[];
  activeConcurrencyCount?: number;
}

declare global {
  const __BUILD_DATE__: string;
  interface Window {
    MathJax: {
      typesetPromise: (elements: any[]) => Promise<void>;
    };
    pdfjsLib: any;
  }
}
