export type AIAction =
  | 'translate'
  | 'rewrite'
  | 'summarize'
  | 'shorten'
  | 'professional'
  | 'friendly'
  | 'voice_to_text'
  | 'extract_info';

export interface AIServicePort {
  readonly provider: string;
  readonly isAvailable: boolean;

  initialize(config: Record<string, unknown>): Promise<void>;

  processText(
    text: string,
    action: AIAction,
    options?: {
      targetLanguage?: string;
      tone?: string;
      maxLength?: number;
    },
  ): Promise<{
    result: string;
    confidence: number;
    tokens: number;
  }>;

  processVoice(
    audioFilePath: string,
    options?: {
      language?: string;
    },
  ): Promise<{
    text: string;
    confidence: number;
    language: string;
  }>;
}
