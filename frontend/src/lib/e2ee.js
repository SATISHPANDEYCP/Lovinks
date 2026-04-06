const RSA_ALGORITHM = {
  name: "RSA-OAEP",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
};

const AES_ALGORITHM_NAME = "AES-GCM";
const AES_KEY_LENGTH = 256;
const E2EE_VERSION = "rsa-aes-gcm-v1";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64 = (arrayBuffer) => {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

const fromBase64 = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const getStorageKey = (userId, type) => `chat-e2ee-${type}-${userId}`;

const parseStoredJwk = (value) => {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const importPublicKey = async (publicKeyJwk) =>
  crypto.subtle.importKey("jwk", publicKeyJwk, RSA_ALGORITHM, true, ["encrypt"]);

const importPrivateKey = async (privateKeyJwk) =>
  crypto.subtle.importKey("jwk", privateKeyJwk, RSA_ALGORITHM, true, ["decrypt"]);

export const ensureLocalUserKeyPair = async (userId) => {
  if (!userId) throw new Error("Missing user id for encryption key setup");

  const privateKeyStorageKey = getStorageKey(userId, "private");
  const publicKeyStorageKey = getStorageKey(userId, "public");

  const storedPrivateJwk = parseStoredJwk(localStorage.getItem(privateKeyStorageKey));
  const storedPublicJwk = parseStoredJwk(localStorage.getItem(publicKeyStorageKey));

  if (storedPrivateJwk && storedPublicJwk) {
    return {
      privateKeyJwk: storedPrivateJwk,
      publicKeyJwk: storedPublicJwk,
    };
  }

  const keyPair = await crypto.subtle.generateKey(RSA_ALGORITHM, true, ["encrypt", "decrypt"]);
  const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);

  localStorage.setItem(privateKeyStorageKey, JSON.stringify(privateKeyJwk));
  localStorage.setItem(publicKeyStorageKey, JSON.stringify(publicKeyJwk));

  return { privateKeyJwk, publicKeyJwk };
};

export const encryptTextForUsers = async ({ text, receiverPublicKey, senderPublicKey }) => {
  if (!text || !receiverPublicKey || !senderPublicKey) return null;

  const encryptedPayload = await encryptStringForUsers({
    content: text,
    receiverPublicKey,
    senderPublicKey,
  });

  if (!encryptedPayload) return null;

  return {
    encryptedText: encryptedPayload.encryptedData,
    encryptionIv: encryptedPayload.encryptionIv,
    encryptedKeyForReceiver: encryptedPayload.encryptedKeyForReceiver,
    encryptedKeyForSender: encryptedPayload.encryptedKeyForSender,
    encryptionVersion: encryptedPayload.encryptionVersion,
  };
};

export const encryptStringForUsers = async ({ content, receiverPublicKey, senderPublicKey }) => {
  if (!content || !receiverPublicKey || !senderPublicKey) return null;

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await crypto.subtle.generateKey(
    {
      name: AES_ALGORITHM_NAME,
      length: AES_KEY_LENGTH,
    },
    true,
    ["encrypt", "decrypt"]
  );

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: AES_ALGORITHM_NAME,
      iv,
    },
    aesKey,
    encoder.encode(content)
  );

  const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);

  const receiverKey = await importPublicKey(receiverPublicKey);
  const senderKey = await importPublicKey(senderPublicKey);

  const encryptedKeyForReceiver = await crypto.subtle.encrypt(RSA_ALGORITHM, receiverKey, rawAesKey);
  const encryptedKeyForSender = await crypto.subtle.encrypt(RSA_ALGORITHM, senderKey, rawAesKey);

  return {
    encryptedData: toBase64(encryptedBuffer),
    encryptionIv: toBase64(iv.buffer),
    encryptedKeyForReceiver: toBase64(encryptedKeyForReceiver),
    encryptedKeyForSender: toBase64(encryptedKeyForSender),
    encryptionVersion: E2EE_VERSION,
  };
};

export const decryptTextForMessage = async ({ message, viewerId }) => {
  if (!message?.encryptedText) return message?.text || "";

  return decryptStringPayload({
    encryptedData: message.encryptedText,
    encryptionIv: message.encryptionIv,
    encryptedKeyForReceiver: message.encryptedKeyForReceiver,
    encryptedKeyForSender: message.encryptedKeyForSender,
    viewerId,
    senderId: message.senderId,
    fallbackText: "[Unable to decrypt message]",
  });
};

export const decryptStringPayload = async ({
  encryptedData,
  encryptionIv,
  encryptedKeyForReceiver,
  encryptedKeyForSender,
  viewerId,
  senderId,
  fallbackText = "[Encrypted message]",
}) => {
  if (!encryptedData) return "";

  if (!viewerId) return "[Encrypted message]";

  const privateKeyStorageKey = getStorageKey(viewerId, "private");
  const privateKeyJwk = parseStoredJwk(localStorage.getItem(privateKeyStorageKey));

  if (!privateKeyJwk) return "[Encrypted message]";

  const wrappedKeyBase64 =
    String(senderId) === String(viewerId) ? encryptedKeyForSender : encryptedKeyForReceiver;

  if (!wrappedKeyBase64 || !encryptionIv) {
    return "[Encrypted message]";
  }

  try {
    const privateKey = await importPrivateKey(privateKeyJwk);
    const decryptedRawAesKey = await crypto.subtle.decrypt(
      RSA_ALGORITHM,
      privateKey,
      fromBase64(wrappedKeyBase64)
    );

    const aesKey = await crypto.subtle.importKey(
      "raw",
      decryptedRawAesKey,
      { name: AES_ALGORITHM_NAME },
      false,
      ["decrypt"]
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: AES_ALGORITHM_NAME,
        iv: new Uint8Array(fromBase64(encryptionIv)),
      },
      aesKey,
      fromBase64(encryptedData)
    );

    return decoder.decode(decryptedBuffer);
  } catch {
    return fallbackText;
  }
};
