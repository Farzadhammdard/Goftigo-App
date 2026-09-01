export interface CryptoPort {
  generateKeyPair(): Promise<{publicKey: string; privateKey: string}>;

  encrypt(
    data: string,
    publicKey: string,
  ): Promise<string>;

  decrypt(
    encryptedData: string,
    privateKey: string,
  ): Promise<string>;

  hash(data: string): Promise<string>;

  generateHMAC(data: string, secret: string): Promise<string>;

  secureStore(key: string, value: string): Promise<void>;
  secureRetrieve(key: string): Promise<string | null>;
  secureDelete(key: string): Promise<void>;
}
