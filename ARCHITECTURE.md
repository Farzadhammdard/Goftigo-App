# Goftegoo Architecture Analysis & Technical Proposals

## 1. TECHNICAL RISK ANALYSIS

### HIGH RISK

| Risk | Impact | Mitigation |
|------|--------|------------|
| **P2P/Nearby on React Native** | BLE and Wi-Fi Direct require native Android APIs. RN has no built-in P2P support. | Native Android module (`react-native-nearby`) exposing a clean TypeScript bridge interface. Design the `NearbyDiscoveryPort` interface first so the RN layer only calls abstract methods. |
| **Offline-first message sync** | Conflict resolution when two users send messages offline and reconnect. | CRDT-style vector clocks per conversation. Each device generates monotonically increasing message sequence numbers. Server reconciles on reconnect. |
| **iOS future compatibility for P2P** | iOS does NOT support Wi-Fi Direct or raw BLE data transfer the same way Android does. Multipeer Connectivity is iOS-only. | The `NearbyDiscoveryPort` and `P2PTransportPort` interfaces must abstract away platform specifics. iOS will use Multipeer Connectivity. The interface contract stays identical. |
| **Mesh networking** | Extremely complex, unreliable, and high battery cost. Not viable for v1. | Design the `MeshTransport` interface but do NOT implement. Document as future. |

### MEDIUM RISK

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Real-time WebSocket on mobile** | Background disconnections, reconnection storms, battery drain | Smart reconnect with exponential backoff. WebSocket only active when app is foregrounded or actively messaging. Use FCM for push notifications to wake app. |
| **Translation quality** | Poor translation damages product trust | AI abstraction layer. Start with Google Translate API, allow swapping to Azure/DeepL. Cache translations locally. |
| **SQLite on React Native** | Performance with large message histories | Use `op-sqlite` (fastest RN SQLite binding). Implement cursor-based pagination. Never load full conversation into memory. |
| **Voice message recording** | Audio quality, format, compression, waveform generation | Native Android `MediaRecorder` → AAC format. Waveform from PCM samples. All behind `AudioRecordingPort`. |

### LOW RISK (but notable)

| Risk | Impact | Mitigation |
|------|--------|------------|
| **RTL layout** | React Native's RTL support is decent but imperfect | Use `react-native-reanimated` + custom layout utilities. Test on real RTL devices. |
| **Phone verification** | SMS delivery in Afghanistan can be unreliable | Support voice call verification as fallback. Use Twilio or similar. |
| **File transfer progress** | Large files over P2P need chunked transfer | Chunk-based transfer protocol with progress tracking per chunk. Resumable from last successful chunk. |

---

## 2. ARCHITECTURE PROPOSAL

### Layered Architecture (Clean Architecture variant)

```
┌──────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                     │
│  Screens / Components / ViewModels (Hooks) / Navigation  │
├──────────────────────────────────────────────────────────┤
│                     DOMAIN LAYER                         │
│  Use Cases / Entities / Repository Interfaces / Ports    │
├──────────────────────────────────────────────────────────┤
│                      DATA LAYER                          │
│  Repository Impls / API Client / Local DB / Cache        │
├──────────────────────────────────────────────────────────┤
│                   TRANSPORT LAYER                        │
│  CommunicationTransport interface + implementations      │
├──────────────────────────────────────────────────────────┤
│                  PLATFORM LAYER                          │
│  Native Modules / Permissions / BLE / Wi-Fi / Audio      │
└──────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Ports & Adapters** - Domain layer defines interfaces (ports). Data and platform layers provide implementations (adapters).
2. **Offline-First** - Every screen reads from local DB first. Background sync updates local state.
3. **Transport Agnostic** - Messaging logic never knows if data travels via WebSocket or BLE.
4. **Unidirectional Data Flow** - State flows down, events flow up. Predictable state management.

---

## 3. FOLDER STRUCTURE

```
goftgoo/
├── android/                          # Android native project
│   └── app/src/main/java/com/goftgoo/
│       ├── nearby/                   # BLE + Wi-Fi Direct native module
│       ├── audio/                    # Audio recording native module
│       ├── crypto/                   # Native crypto operations
│       └── GoftegooPackage.java      # React Native package registration
│
├── src/                              # TypeScript / React Native source
│   ├── app/                          # App entry, providers, root component
│   │   ├── App.tsx
│   │   ├── providers/
│   │   │   ├── ThemeProvider.tsx
│   │   │   ├── AuthProvider.tsx
│   │   │   ├── TransportProvider.tsx
│   │   │   └── DiagnosticsProvider.tsx
│   │   └── navigation/
│   │       ├── RootNavigator.tsx
│   │       ├── AuthNavigator.tsx
│   │       ├── MainTabNavigator.tsx
│   │       └── types.ts
│   │
│   ├── core/                         # Shared utilities, constants, types
│   │   ├── constants/
│   │   │   ├── colors.ts
│   │   │   ├── typography.ts
│   │   │   ├── spacing.ts
│   │   │   ├── dimensions.ts
│   │   │   └── config.ts
│   │   ├── types/
│   │   │   ├── models.ts            # Domain entities
│   │   │   ├── api.ts               # API request/response types
│   │   │   ├── transport.ts         # Transport layer types
│   │   │   ├── events.ts            # Event system types
│   │   │   └── diagnostics.ts       # Diagnostic types
│   │   ├── utils/
│   │   │   ├── validation.ts
│   │   │   ├── formatters.ts
│   │   │   ├── crypto.ts
│   │   │   └── platform.ts
│   │   └── ports/                   # Interface definitions (ports)
│   │       ├── TransportPort.ts
│   │       ├── StoragePort.ts
│   │       ├── NearbyDiscoveryPort.ts
│   │       ├── AudioPort.ts
│   │       ├── NetworkPort.ts
│   │       ├── NotificationPort.ts
│   │       ├── AI Port.ts
│   │       └── CryptoPort.ts
│   │
│   ├── data/                        # Data layer implementations
│   │   ├── api/
│   │   │   ├── client.ts            # HTTP client (fetch/axios)
│   │   │   ├── websocket.ts         # WebSocket manager
│   │   │   ├── endpoints.ts         # API endpoint constants
│   │   │   └── interceptors.ts      # Auth token injection, retry
│   │   ├── repositories/
│   │   │   ├── AuthRepository.ts
│   │   │   ├── UserRepository.ts
│   │   │   ├── ConversationRepository.ts
│   │   │   ├── MessageRepository.ts
│   │   │   ├── GroupRepository.ts
│   │   │   ├── PostRepository.ts
│   │   │   └── SettingsRepository.ts
│   │   ├── database/
│   │   │   ├── schema.ts            # SQLite table definitions
│   │   │   ├── migrations.ts        # DB version management
│   │   │   ├── queries/
│   │   │   │   ├── messageQueries.ts
│   │   │   │   ├── conversationQueries.ts
│   │   │   │   └── userQueries.ts
│   │   │   └── connection.ts        # DB connection singleton
│   │   ├── cache/
│   │   │   ├── imageCache.ts
│   │   │   └── queryCache.ts
│   │   └── sync/
│   │       ├── syncManager.ts       # Orchestrates online/offline sync
│   │       ├── offlineQueue.ts      # Queue for pending operations
│   │       └── conflictResolver.ts  # Handles sync conflicts
│   │
│   ├── domain/                      # Domain layer (pure business logic)
│   │   ├── auth/
│   │   │   ├── useCases/
│   │   │   │   ├── RegisterUseCase.ts
│   │   │   │   ├── LoginUseCase.ts
│   │   │   │   ├── VerifyOtpUseCase.ts
│   │   │   │   └── LogoutUseCase.ts
│   │   │   └── AuthState.ts
│   │   ├── messaging/
│   │   │   ├── useCases/
│   │   │   │   ├── SendMessageUseCase.ts
│   │   │   │   ├── ReceiveMessageUseCase.ts
│   │   │   │   ├── LoadMessagesUseCase.ts
│   │   │   │   ├── EditMessageUseCase.ts
│   │   │   │   ├── DeleteMessageUseCase.ts
│   │   │   │   ├── ReactToMessageUseCase.ts
│   │   │   │   ├── TranslateMessageUseCase.ts
│   │   │   │   └── ForwardMessageUseCase.ts
│   │   │   └── MessageHandler.ts    # Transport-agnostic message routing
│   │   ├── conversations/
│   │   │   ├── useCases/
│   │   │   │   ├── LoadConversationsUseCase.ts
│   │   │   │   ├── CreateConversationUseCase.ts
│   │   │   │   └── SearchConversationsUseCase.ts
│   │   │   └── ConversationSorter.ts
│   │   ├── groups/
│   │   │   └── useCases/
│   │   ├── social/
│   │   │   └── useCases/
│   │   ├── nearby/
│   │   │   ├── useCases/
│   │   │   │   ├── StartDiscoveryUseCase.ts
│   │   │   │   ├── StopDiscoveryUseCase.ts
│   │   │   │   ├── SendConnectionRequestUseCase.ts
│   │   │   │   └── AcceptConnectionUseCase.ts
│   │   │   └── NearbySessionManager.ts
│   │   ├── translation/
│   │   │   └── useCases/
│   │   ├── ai/
│   │   │   ├── AIServicePort.ts     # Abstract AI interface
│   │   │   └── useCases/
│   │   └── diagnostics/
│   │       └── DiagnosticsManager.ts
│   │
│   ├── transport/                   # Transport layer implementations
│   │   ├── CommunicationTransport.ts  # Core interface
│   │   ├── OnlineTransport.ts
│   │   ├── LocalNetworkTransport.ts
│   │   ├── NearbyP2PTransport.ts
│   │   ├── TransportManager.ts      # Selects best transport
│   │   └── MessageRouter.ts         # Routes messages through correct transport
│   │
│   ├── features/                    # Feature-specific screens & components
│   │   ├── auth/
│   │   │   ├── screens/
│   │   │   │   ├── PhoneInputScreen.tsx
│   │   │   │   ├── OtpVerificationScreen.tsx
│   │   │   │   ├── ProfileSetupScreen.tsx
│   │   │   │   └── LoginScreen.tsx
│   │   │   └── components/
│   │   │       ├── PhoneInput.tsx
│   │   │       └── OtpInput.tsx
│   │   ├── chat/
│   │   │   ├── screens/
│   │   │   │   └── ChatScreen.tsx
│   │   │   └── components/
│   │   │       ├── MessageBubble.tsx
│   │   │       ├── MessageInput.tsx
│   │   │       ├── MessageActions.tsx
│   │   │       ├── VoiceMessage.tsx
│   │   │       ├── ImageMessage.tsx
│   │   │       ├── FileMessage.tsx
│   │   │       ├── TranslationOverlay.tsx
│   │   │       └── ChatHeader.tsx
│   │   ├── conversations/
│   │   │   ├── screens/
│   │   │   │   └── ConversationsScreen.tsx
│   │   │   └── components/
│   │   │       ├── ConversationItem.tsx
│   │   │       └── ConversationList.tsx
│   │   ├── nearby/
│   │   │   ├── screens/
│   │   │   │   └── NearbyScreen.tsx
│   │   │   └── components/
│   │   │       ├── NearbyUserCard.tsx
│   │   │       ├── ScanButton.tsx
│   │   │       └── ConnectionRequest.tsx
│   │   ├── social/
│   │   │   ├── screens/
│   │   │   │   └── SocialFeedScreen.tsx
│   │   │   └── components/
│   │   │       ├── PostCard.tsx
│   │   │       ├── PostComposer.tsx
│   │   │       └── CommentSheet.tsx
│   │   ├── calls/
│   │   │   ├── screens/
│   │   │   └── components/
│   │   ├── profile/
│   │   │   ├── screens/
│   │   │   │   └── ProfileScreen.tsx
│   │   │   └── components/
│   │   ├── settings/
│   │   │   ├── screens/
│   │   │   └── components/
│   │   ├── search/
│   │   │   ├── screens/
│   │   │   │   └── GlobalSearchScreen.tsx
│   │   │   └── components/
│   │   └── diagnostics/
│   │       ├── screens/
│   │       │   └── DiagnosticsScreen.tsx
│   │       └── components/
│   │           ├── DiagnosticRow.tsx
│   │           └── DiagnosticDetail.tsx
│   │
│   ├── shared/                      # Shared reusable components
│   │   ├── components/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── BottomSheet.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── LoadingIndicator.tsx
│   │   │   ├── ErrorState.tsx
│   │   │   ├── RTLWrapper.tsx
│   │   │   └── animations/
│   │   │       ├── FadeIn.tsx
│   │   │       ├── SlideUp.tsx
│   │   │       └── ScalePress.tsx
│   │   ├── hooks/
│   │   │   ├── useTheme.ts
│   │   │   ├── useRTL.ts
│   │   │   ├── useNetworkStatus.ts
│   │   │   ├── usePermissions.ts
│   │   │   └── useDiagnosis.ts
│   │   └── hocs/
│   │       └── withAuth.tsx
│   │
│   └── store/                       # State management (Zustand)
│       ├── authStore.ts
│       ├── conversationStore.ts
│       ├── messageStore.ts
│       ├── userStore.ts
│       ├── nearbyStore.ts
│       ├── socialStore.ts
│       ├── settingsStore.ts
│       ├── transportStore.ts
│       └── diagnosticsStore.ts
│
├── __tests__/                       # Tests
│   ├── unit/
│   │   ├── domain/
│   │   ├── data/
│   │   └── transport/
│   ├── integration/
│   │   ├── messaging.test.ts
│   │   ├── sync.test.ts
│   │   └── transport.test.ts
│   └── mocks/
│       ├── transport/
│       └── api/
│
├── package.json
├── tsconfig.json
├── babel.config.js
├── metro.config.js
├── .eslintrc.js
├── .prettierrc
└── app.json
```

---

## 4. DATA MODELS

### Core Entities

```typescript
// User
interface User {
  id: string;                    // GFT-XXXXXXXX
  phoneNumber: string;
  username: string;              // @farzad
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  isOnline: boolean;
  lastSeenAt: number;            // timestamp
  createdAt: number;
  updatedAt: number;
}

// Conversation
interface Conversation {
  id: string;
  type: 'direct' | 'group';
  participantIds: string[];
  lastMessage: Message | null;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  transportPath: TransportType;  // which transport was last used
  createdAt: number;
  updatedAt: number;
}

// Message
interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  type: 'text' | 'image' | 'video' | 'file' | 'voice' | 'system';
  content: string;               // text or file URL or voice URL
  metadata: MessageMetadata | null;
  replyTo: string | null;        // message ID being replied to
  forwardedFrom: string | null;  // original sender if forwarded
  reactions: Reaction[];
  translation: Translation | null;
  isEdited: boolean;
  isDeleted: boolean;
  isStarred: boolean;
  isPinned: boolean;
  status: MessageStatus;         // sending | sent | delivered | read
  transportPath: TransportType;
  sequenceNumber: number;        // for conflict resolution
  createdAt: number;
  updatedAt: number;
}

type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';
type TransportType = 'online' | 'local_network' | 'nearby_p2p' | 'mesh';

interface MessageMetadata {
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  width?: number;
  height?: number;
  duration?: number;             // for voice/video
  waveform?: number[];           // for voice
  thumbnailUrl?: string;
}

interface Reaction {
  userId: string;
  emoji: string;
  createdAt: number;
}

interface Translation {
  text: string;
  language: string;
  provider: string;
  createdAt: number;
}

// Group
interface Group {
  id: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  creatorId: string;
  adminIds: string[];
  memberIds: string[];
  createdAt: number;
  updatedAt: number;
}

// Post (Social Feed)
interface Post {
  id: string;
  authorId: string;
  imageUrl: string;
  caption: string | null;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  isLikedByMe: boolean;
  isSavedByMe: boolean;
  createdAt: number;
  updatedAt: number;
}

// Offline Queue Entry
interface OfflineQueueEntry {
  id: string;
  operation: 'send_message' | 'edit_message' | 'delete_message' | 'create_conversation' | 'upload_file';
  payload: Record<string, unknown>;
  transportPath: TransportType;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  lastAttemptAt: number | null;
  status: 'pending' | 'processing' | 'failed' | 'completed';
}

// Nearby Device (during scan)
interface NearbyDevice {
  deviceId: string;
  displayName: string;
  userId: string | null;         // null if not yet identified
  signalStrength: number;        // RSSI
  transportCapabilities: TransportType[];
  discoveredAt: number;
}
```

---

## 5. TRANSPORT ABSTRACTION

```typescript
// The core transport interface
interface CommunicationTransport {
  readonly type: TransportType;
  readonly isAvailable: boolean;

  // Lifecycle
  initialize(): Promise<void>;
  destroy(): Promise<void>;

  // Connection
  connect(targetId: string): Promise<Connection>;
  disconnect(connectionId: string): Promise<void>;

  // Messaging
  sendMessage(connectionId: string, message: OutgoingMessage): Promise<SendResult>;
  onMessage(handler: (message: IncomingMessage) => void): void;

  // Status
  getConnectionStatus(connectionId: string): ConnectionStatus;
  onStatusChange(handler: (status: ConnectionStatusEvent) => void): void;

  // Capabilities
  getCapabilities(): TransportCapabilities;
}

interface TransportCapabilities {
  supportsText: boolean;
  supportsFiles: boolean;
  supportsVoice: boolean;
  maxFileSize: number;
  isEncrypted: boolean;
  requiresProximity: boolean;
  requiresInternet: boolean;
}

// Transport Manager selects the best available transport
interface TransportManager {
  getAvailableTransports(): CommunicationTransport[];
  selectBestTransport(targetId: string, messageType: string): CommunicationTransport;
  onTransportAvailabilityChange(handler: (availability: TransportAvailability) => void): void;
}
```

---

## 6. ANDROID NATIVE INTEGRATION STRATEGY

| Feature | React Native Approach | Native Module Required? |
|---------|----------------------|------------------------|
| Navigation | `@react-navigation/native` | No |
| State Management | Zustand | No |
| Local DB | `op-sqlite` | No |
| HTTP | `fetch` + custom client | No |
| WebSocket | `WebSocket` API | No |
| Image picking | `react-native-image-picker` | No |
| Camera | `react-native-camera` or expo | No |
| Permissions | `react-native-permissions` | No |
| Push notifications | `@react-native-firebase/messaging` | No |
| **BLE scanning/advertising** | Must use native | **YES** |
| **Wi-Fi Direct** | Must use native | **YES** |
| **Audio recording (high quality)** | Must use native | **YES** |
| **Background tasks** | Must use native | **YES** |
| **Crypto (key storage)** | `react-native-keychain` + native | Partially |
| **File system (scoped)** | `react-native-fs` | No |

### Native Module Design

```java
// Android native module bridge
// goftgoo-nearby module

@ReactModule(name = "GoftegooNearby")
public class GoftegooNearbyModule extends ReactContextBaseJavaModule {
    
    // Start BLE advertising + scanning
    @ReactMethod
    public void startDiscovery(Promise promise) { ... }
    
    // Stop all discovery
    @ReactMethod
    public void stopDiscovery(Promise promise) { ... }
    
    // Get discovered devices (emits events)
    @ReactMethod
    public void addListener(String eventName) { ... }
    
    @ReactMethod
    public void removeListeners(Integer count) { ... }
    
    // Send connection request to a device
    @ReactMethod
    public void sendConnectionRequest(String deviceId, String payload, Promise promise) { ... }
    
    // Accept incoming connection
    @ReactMethod
    public void acceptConnection(String connectionId, Promise promise) { ... }
    
    // Send data over P2P connection
    @ReactMethod
    public void sendData(String connectionId, String data, Promise promise) { ... }
}

// Events emitted to JS:
// "nearbyDeviceFound"  -> { deviceId, displayName, signalStrength }
// "nearbyDeviceLost"   -> { deviceId }
// "connectionReceived" -> { connectionId, deviceId, payload }
// "connectionEstablished" -> { connectionId }
// "dataReceived"       -> { connectionId, data }
// "connectionLost"     -> { connectionId }
```

---

## 7. LOCAL STORAGE STRATEGY

### SQLite Schema (Core Tables)

```sql
-- Users cache
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  phone_number TEXT,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  is_online INTEGER DEFAULT 0,
  last_seen_at INTEGER,
  created_at INTEGER,
  updated_at INTEGER
);

-- Conversations
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,            -- 'direct' | 'group'
  name TEXT,
  avatar_url TEXT,
  last_message_id TEXT,
  unread_count INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  is_muted INTEGER DEFAULT 0,
  transport_path TEXT DEFAULT 'online',
  created_at INTEGER,
  updated_at INTEGER
);

-- Conversation participants
CREATE TABLE conversation_participants (
  conversation_id TEXT,
  user_id TEXT,
  role TEXT DEFAULT 'member',   -- 'admin' | 'member'
  joined_at INTEGER,
  PRIMARY KEY (conversation_id, user_id)
);

-- Messages (most critical table)
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  type TEXT NOT NULL,            -- 'text' | 'image' | 'video' | 'file' | 'voice' | 'system'
  content TEXT,
  metadata TEXT,                 -- JSON
  reply_to TEXT,
  forwarded_from TEXT,
  is_edited INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,
  is_starred INTEGER DEFAULT 0,
  is_pinned INTEGER DEFAULT 0,
  status TEXT DEFAULT 'sending',
  transport_path TEXT DEFAULT 'online',
  sequence_number INTEGER,
  created_at INTEGER,
  updated_at INTEGER,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);

-- Message reactions
CREATE TABLE message_reactions (
  message_id TEXT,
  user_id TEXT,
  emoji TEXT,
  created_at INTEGER,
  PRIMARY KEY (message_id, user_id, emoji)
);

-- Translations cache
CREATE TABLE translations (
  message_id TEXT,
  text TEXT,
  language TEXT,
  provider TEXT,
  created_at INTEGER,
  PRIMARY KEY (message_id, language)
);

-- Social posts
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  image_url TEXT,
  caption TEXT,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  is_liked_by_me INTEGER DEFAULT 0,
  is_saved_by_me INTEGER DEFAULT 0,
  created_at INTEGER,
  updated_at INTEGER
);

-- Offline queue
CREATE TABLE offline_queue (
  id TEXT PRIMARY KEY,
  operation TEXT NOT NULL,
  payload TEXT NOT NULL,         -- JSON
  transport_path TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  status TEXT DEFAULT 'pending',
  created_at INTEGER,
  last_attempt_at INTEGER
);

-- Media metadata
CREATE TABLE media (
  id TEXT PRIMARY KEY,
  message_id TEXT,
  local_path TEXT,
  remote_url TEXT,
  mime_type TEXT,
  file_size INTEGER,
  width INTEGER,
  height INTEGER,
  duration INTEGER,
  created_at INTEGER
);

-- Settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER
);
```

### Storage Strategy Rules:
1. **Write-through**: All writes go to local DB first, then sync to server
2. **Read-local**: All reads come from local DB
3. **Background sync**: Periodic sync updates local state
4. **Pagination**: Messages loaded in batches of 50, using cursor-based pagination
5. **Cleanup**: Old media files cleaned up based on storage pressure

---

## 8. DIAGNOSTICS ARCHITECTURE

```typescript
type DiagnosticStatus = 'ok' | 'warning' | 'error' | 'unknown';

interface DiagnosticCheck {
  name: string;
  displayName: string;
  status: DiagnosticStatus;
  message: string;
  technicalDetails: string;
  recommendedAction: string | null;
  lastCheckedAt: number;
}

interface DiagnosticsReport {
  checks: DiagnosticCheck[];
  overallStatus: DiagnosticStatus;
  generatedAt: number;
  deviceInfo: {
    platform: string;
    osVersion: string;
    appVersion: string;
    storageUsed: number;
    storageAvailable: number;
  };
}

// Diagnostic checks:
// 1. Internet connectivity
// 2. API server reachability
// 3. WebSocket connection state
// 4. Authentication / account status
// 5. Local database integrity
// 6. Storage availability
// 7. Permissions (camera, mic, contacts, nearby, location)
// 8. Bluetooth state
// 9. Nearby discovery state
// 10. P2P connection state
// 11. Notification permissions
// 12. Audio permissions
// 13. Background task status
// 14. Sync queue status
```

---

## 9. DEVELOPMENT MILESTONES

### Milestone 1: Foundation (Current)
- [x] Architecture analysis
- [ ] Project initialization (React Native + TypeScript)
- [ ] Core theme system (colors, typography, spacing)
- [ ] Navigation structure (auth flow + main tabs)
- [ ] Shared UI components (Button, Input, Card, Avatar)
- [ ] Zustand store setup
- [ ] Basic RTL support

### Milestone 2: Authentication
- [ ] Phone input screen
- [ ] OTP verification screen
- [ ] Profile setup screen
- [ ] Auth API integration
- [ ] Secure token storage
- [ ] Auth state management

### Milestone 3: Local Storage
- [ ] SQLite schema creation
- [ ] Database connection manager
- [ ] CRUD operations for all entities
- [ ] Migration system
- [ ] Seed data for development

### Milestone 4: Transport Abstraction
- [ ] CommunicationTransport interface
- [ ] OnlineTransport (WebSocket)
- [ ] TransportManager
- [ ] MessageRouter
- [ ] Offline queue

### Milestone 5: Messaging
- [ ] Conversations list
- [ ] Chat screen
- [ ] Text messages
- [ ] Message status tracking
- [ ] Message actions (reply, forward, edit, delete)
- [ ] Reactions

### Milestone 6: Media & Voice
- [ ] Image messages
- [ ] Voice recording
- [ ] Voice playback with waveform
- [ ] File messages
- [ ] File transfer with progress

### Milestone 7: Nearby Discovery
- [ ] Native Android BLE module
- [ ] Nearby scanning screen
- [ ] Connection request flow
- [ ] P2P message transport
- [ ] Diagnostics integration

### Milestone 8: Social & Groups
- [ ] Social feed
- [ ] Post creation
- [ ] Comments & likes
- [ ] Group creation
- [ ] Group messaging

### Milestone 9: Translation & AI
- [ ] Translation service abstraction
- [ ] Message translation UI
- [ ] AI text transformation
- [ ] Translation caching

### Milestone 10: Polish & Diagnostics
- [ ] Diagnostics screen
- [ ] Performance optimization
- [ ] Error handling audit
- [ ] Dark mode polish
- [ ] Accessibility pass

---

## 10. IMPOSSIBLE / RISKY ITEMS

1. **True mesh networking**: Not possible with current consumer Android APIs. Devices cannot relay for each other without custom firmware or rooted devices. → Document as future architecture, do not implement.

2. **Background P2P communication**: Android 12+ severely restricts BLE scanning in background. The spec correctly states scanning should be user-initiated. → Follow spec strictly. No background scanning.

3. **iOS Wi-Fi Direct equivalent**: iOS does not expose Wi-Fi Direct. Only Multipeer Connectivity (Bonjour-based) is available. → Design abstract interface, implement iOS-specific adapter later.

4. **Real-time voice calls over P2P**: Extremely complex (NAT traversal, codec negotiation, jitter buffers). → Design the interface but implement as online-only first. P2P calling is a major future effort.

5. **End-to-end encryption for P2P**: Without a key exchange server, secure key distribution between P2P devices is very hard (TOFU model at best). → Use ECDH key exchange during connection pairing. Accept TOFU trust model for P2P.

6. **Offline message delivery**: Without internet, messages can only reach users within P2P range. Multi-hop relay is the mesh problem above. → Be honest in UX: "Message will be delivered when {user} is nearby."
