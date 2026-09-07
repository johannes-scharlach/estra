import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import { ActionSheetIOS, Alert, Platform } from "react-native";

import { supabase } from "@/lib/supabase";

import type { Parts } from "./stream";

export type ImageAttachment = { uri: string; mediaType: string };
export type FilePart = Extract<Parts[number], { type: "file" }>;

const BUCKET = "chat-images";
/** Long enough for a household to scroll back through a season of chats. */
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 30;

const CAMERA_PICK: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 0.5,
  allowsMultipleSelection: false,
};

const LIBRARY_PICK: ImagePicker.ImagePickerOptions = {
  ...CAMERA_PICK,
  allowsMultipleSelection: true,
};

function toAttachments(result: ImagePicker.ImagePickerResult): ImageAttachment[] {
  if (result.canceled || !result.assets) return [];
  return result.assets.map((asset) => ({
    uri: asset.uri,
    mediaType: asset.mimeType ?? "image/jpeg",
  }));
}

async function fromCamera(): Promise<ImageAttachment[]> {
  const { granted } = await ImagePicker.requestCameraPermissionsAsync();
  if (!granted) {
    Alert.alert(
      "Camera access needed",
      "Allow camera access in Settings to take a photo, or choose one from your library instead.",
    );
    return [];
  }
  return toAttachments(await ImagePicker.launchCameraAsync(CAMERA_PICK));
}

async function fromLibrary(): Promise<ImageAttachment[]> {
  return toAttachments(await ImagePicker.launchImageLibraryAsync(LIBRARY_PICK));
}

/** "Put it on the table and take a picture." Camera first, library second. */
export function pickImageAttachments(): Promise<ImageAttachment[]> {
  if (Platform.OS === "ios") {
    return new Promise((resolve, reject) => {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Take photo", "Choose from library", "Cancel"], cancelButtonIndex: 2 },
        (i) => {
          if (i === 0) void fromCamera().then(resolve, reject);
          else if (i === 1) void fromLibrary().then(resolve, reject);
          else resolve([]);
        },
      );
    });
  }
  return new Promise((resolve, reject) => {
    Alert.alert(
      "Add a photo",
      undefined,
      [
        { text: "Take photo", onPress: () => void fromCamera().then(resolve, reject) },
        { text: "Choose from library", onPress: () => void fromLibrary().then(resolve, reject) },
        { text: "Cancel", style: "cancel", onPress: () => resolve([]) },
      ],
      { cancelable: true, onDismiss: () => resolve([]) },
    );
  });
}

/**
 * Images do not go into message parts as base64 (ADR 9). They go to a
 * private bucket under the list's id, and the part carries a signed URL that
 * every member's phone can show and the API can download for the model.
 */
export async function uploadImageAttachment(
  listId: string,
  attachment: ImageAttachment,
): Promise<FilePart> {
  const ext = attachment.mediaType === "image/png" ? "png" : "jpg";
  const path = `${listId}/${Crypto.randomUUID()}.${ext}`;
  const bytes = await (await fetch(attachment.uri)).arrayBuffer();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: attachment.mediaType });
  if (error) throw new Error(`Could not upload image: ${error.message}`);

  const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (signed.error || !signed.data) throw new Error("Could not link image");

  return { type: "file", mediaType: attachment.mediaType, url: signed.data.signedUrl, filename: path };
}

export function imageParts(parts: Parts): FilePart[] {
  return parts.filter(
    (p): p is FilePart => p.type === "file" && p.mediaType.startsWith("image/"),
  );
}
