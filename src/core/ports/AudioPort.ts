export interface AudioPort {
  readonly isRecording: boolean;
  readonly isAvailable: boolean;

  requestPermission(): Promise<boolean>;

  startRecording(options?: {
    sampleRate?: number;
    channels?: number;
    bitRate?: number;
    format?: 'aac' | 'wav' | 'ogg';
  }): Promise<void>;

  stopRecording(): Promise<{
    filePath: string;
    duration: number;
    fileSize: number;
    waveform: number[];
  }>;

  pauseRecording(): Promise<void>;
  resumeRecording(): Promise<void>;

  cancelRecording(): Promise<void>;

  playAudio(filePath: string, options?: {speed?: number}): Promise<void>;
  pausePlayback(): Promise<void>;
  resumePlayback(): Promise<void>;
  stopPlayback(): Promise<void>;

  onPlaybackProgress(handler: (progress: {position: number; duration: number}) => void): void;
}
