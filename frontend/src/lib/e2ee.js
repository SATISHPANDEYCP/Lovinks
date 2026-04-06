const RSA_ALGORITHM = {
  name: "RSA-OAEP",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
};

const AES_ALGORITHM_NAME = "AES-GCM";
const AES_KEY_LENGTH = 256;
const E2EE_VERSION = "rsa-aes-gcm-v1";
const DEVICE_ID_STORAGE_KEY = "chat-e2ee-device-id";

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

export const getLocalDeviceId = () => {
  let deviceId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (deviceId) return deviceId;

  if (typeof crypto.randomUUID === "function") {
    deviceId = crypto.randomUUID();
  } else {
    deviceId = `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  return deviceId;
};

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

const parsePublicKeyJwk = (value) => {
  if (!value || typeof value !== "string") return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const getUserDevicePublicKeys = (user) => {
  const output = [];

  if (Array.isArray(user?.encryptionPublicKeys)) {
    user.encryptionPublicKeys.forEach((item) => {
      const deviceId = String(item?.deviceId || "").trim();
      const publicKeyJwk = parsePublicKeyJwk(item?.encryptionPublicKey);

      if (deviceId && publicKeyJwk) {
        output.push({ deviceId, publicKeyJwk });
      }
    });
  }

  if (!output.length) {
    const legacyPublicKeyJwk = parsePublicKeyJwk(user?.encryptionPublicKey);
    if (legacyPublicKeyJwk) {
      output.push({ deviceId: "legacy", publicKeyJwk: legacyPublicKeyJwk });
    }
  }

  // Deduplicate by deviceId while preserving latest item order.
  const unique = new Map();
  output.forEach((item) => unique.set(item.deviceId, item));
  return Array.from(unique.values());
};

const normalizeDeviceKeyInput = ({ keyList, singleKey, fallbackDeviceId }) => {
  if (Array.isArray(keyList) && keyList.length) {
    return keyList
      .filter((item) => item?.publicKeyJwk)
      .map((item) => ({
        deviceId: String(item.deviceId || fallbackDeviceId).trim() || fallbackDeviceId,
        publicKeyJwk: item.publicKeyJwk,
      }));
  }

  if (singleKey) {
    return [{ deviceId: fallbackDeviceId, publicKeyJwk: singleKey }];
  }

  return [];
};

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

export const encryptTextForUsers = async ({
  text,
  receiverPublicKey,
  senderPublicKey,
  receiverPublicKeys,
  senderPublicKeys,
}) => {
  if (!text) return null;

  const encryptedPayload = await encryptStringForUsers({
    content: text,
    receiverPublicKey,
    senderPublicKey,
    receiverPublicKeys,
    senderPublicKeys,
  });

  if (!encryptedPayload) return null;

  return {
    encryptedText: encryptedPayload.encryptedData,
    encryptionIv: encryptedPayload.encryptionIv,
    encryptedKeyForReceiver: encryptedPayload.encryptedKeyForReceiver,
    encryptedKeyForSender: encryptedPayload.encryptedKeyForSender,
    encryptedKeysForReceiverDevices: encryptedPayload.encryptedKeysForReceiverDevices,
    encryptedKeysForSenderDevices: encryptedPayload.encryptedKeysForSenderDevices,
    encryptionVersion: encryptedPayload.encryptionVersion,
  };
};

export const encryptStringForUsers = async ({
  content,
  receiverPublicKey,
  senderPublicKey,
  receiverPublicKeys,
  senderPublicKeys,
}) => {
  if (!content) return null;

  const normalizedReceiverPublicKeys = normalizeDeviceKeyInput({
    keyList: receiverPublicKeys,
    singleKey: receiverPublicKey,
    fallbackDeviceId: "receiver-primary",
  });
  const normalizedSenderPublicKeys = normalizeDeviceKeyInput({
    keyList: senderPublicKeys,
    singleKey: senderPublicKey,
    fallbackDeviceId: "sender-primary",
  });

  if (!normalizedReceiverPublicKeys.length || !normalizedSenderPublicKeys.length) return null;

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

  const encryptedKeysForReceiverDevices = {};
  for (const keyEntry of normalizedReceiverPublicKeys) {
    const importedKey = await importPublicKey(keyEntry.publicKeyJwk);
    const encryptedKey = await crypto.subtle.encrypt(RSA_ALGORITHM, importedKey, rawAesKey);
    encryptedKeysForReceiverDevices[keyEntry.deviceId] = toBase64(encryptedKey);
  }

  const encryptedKeysForSenderDevices = {};
  for (const keyEntry of normalizedSenderPublicKeys) {
    const importedKey = await importPublicKey(keyEntry.publicKeyJwk);
    const encryptedKey = await crypto.subtle.encrypt(RSA_ALGORITHM, importedKey, rawAesKey);
    encryptedKeysForSenderDevices[keyEntry.deviceId] = toBase64(encryptedKey);
  }

  const encryptedKeyForReceiver =
    encryptedKeysForReceiverDevices[normalizedReceiverPublicKeys[0].deviceId] || "";
  const encryptedKeyForSender = encryptedKeysForSenderDevices[normalizedSenderPublicKeys[0].deviceId] || "";

  return {
    encryptedData: toBase64(encryptedBuffer),
    encryptionIv: toBase64(iv.buffer),
    encryptedKeyForReceiver,
    encryptedKeyForSender,
    encryptedKeysForReceiverDevices,
    encryptedKeysForSenderDevices,
    encryptionVersion: E2EE_VERSION,
  };
};

export const decryptTextForMessage = async ({ message, viewerId }) => {
  if (!message?.encryptedText) return message?.text || "";

  const senderFallbackText =
    String(message?.senderId || "") === String(viewerId || "")
      ? message?.text || "[Unable to decrypt message]"
      : "[Unable to decrypt message]";

  return decryptStringPayload({
    encryptedData: message.encryptedText,
    encryptionIv: message.encryptionIv,
    encryptedKeyForReceiver: message.encryptedKeyForReceiver,
    encryptedKeyForSender: message.encryptedKeyForSender,
    encryptedKeysForReceiverDevices: message.encryptedKeysForReceiverDevices,
    encryptedKeysForSenderDevices: message.encryptedKeysForSenderDevices,
    viewerId,
    senderId: message.senderId,
    fallbackText: senderFallbackText,
  });
};

export const decryptStringPayload = async ({
  encryptedData,
  encryptionIv,
  encryptedKeyForReceiver,
  encryptedKeyForSender,
  encryptedKeysForReceiverDevices,
  encryptedKeysForSenderDevices,
  viewerId,
  senderId,
  fallbackText = "[Encrypted message]",
}) => {
  if (!encryptedData) return "";

  if (!viewerId) return "[Encrypted message]";

  const privateKeyStorageKey = getStorageKey(viewerId, "private");
  const privateKeyJwk = parseStoredJwk(localStorage.getItem(privateKeyStorageKey));

  if (!privateKeyJwk) return "[Encrypted message]";

  const currentDeviceId = getLocalDeviceId();
  const senderKeyMap = encryptedKeysForSenderDevices || {};
  const receiverKeyMap = encryptedKeysForReceiverDevices || {};

  const wrappedKeyFromMap =
    String(senderId) === String(viewerId)
      ? senderKeyMap?.[currentDeviceId]
      : receiverKeyMap?.[currentDeviceId];

  const wrappedKeyBase64 =
    wrappedKeyFromMap ||
    (String(senderId) === String(viewerId) ? encryptedKeyForSender : encryptedKeyForReceiver);

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
