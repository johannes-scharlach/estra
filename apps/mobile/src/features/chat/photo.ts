import * as Crypto from "expo-crypto";
import * as ImagePicker from "expo-image-picker";
import { ActionSheetIOS, Alert, Platform } from "react-native";

import { supabase } from "@/lib/supabase";

import type { Parts } from "./stream";

export type Photo = { uri: string; mediaType: string };
export type FilePart = Extract<Parts[number], { type: "file" }>;

const BUCKET = "chat-images";
/** Long enough for a household to scroll back through a season of chats. */
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 30;

const PICK: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 0.5,
  allowsMultipleSelection: false,
};

function toPhoto(result: ImagePicker.ImagePickerResult): Photo | null {
  const asset = result.assets?.[0];
  if (result.canceled || !asset) return null;
  return { uri: asset.uri, mediaType: asset.mimeType ?? "image/jpeg" };
}

async function fromCamera(): Promise<Photo | null> {
  const { granted } = await ImagePicker.requestCameraPermissionsAsync();
  if (!granted) return null;
  return toPhoto(await ImagePicker.launchCameraAsync(PICK));
}

async function fromLibrary(): Promise<Photo | null> {
  return toPhoto(await ImagePicker.launchImageLibraryAsync(PICK));
}

/** "Put it on the table and take a picture." Camera first, library second. */
export function pickPhoto(): Promise<Photo | null> {
  if (Platform.OS === "ios") {
    return new Promise((resolve) => {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Take photo", "Choose from library", "Cancel"], cancelButtonIndex: 2 },
        (i) => {
          if (i === 0) void fromCamera().then(resolve);
          else if (i === 1) void fromLibrary().then(resolve);
          else resolve(null);
        },
      );
    });
  }
  return new Promise((resolve) => {
    Alert.alert("Add a photo", undefined, [
      { text: "Take photo", onPress: () => void fromCamera().then(resolve) },
      { text: "Choose from library", onPress: () => void fromLibrary().then(resolve) },
      { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
    ]);
  });
}

/**
 * Photos do not go into message parts as base64 (ADR 9). They go to a
 * private bucket under the list's id, and the part carries a signed URL that
 * every member's phone can show and the API can download for the model.
 */
export async function uploadPhoto(listId: string, photo: Photo): Promise<FilePart> {
  const ext = photo.mediaType === "image/png" ? "png" : "jpg";
  const path = `${listId}/${Crypto.randomUUID()}.${ext}`;
  const bytes = await (await fetch(photo.uri)).arrayBuffer();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: photo.mediaType });
  if (error) throw new Error(`Could not upload photo: ${error.message}`);

  const signed = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (signed.error || !signed.data) throw new Error("Could not link photo");

  return { type: "file", mediaType: photo.mediaType, url: signed.data.signedUrl, filename: path };
}

export function imageParts(parts: Parts): FilePart[] {
  return parts.filter(
    (p): p is FilePart => p.type === "file" && p.mediaType.startsWith("image/"),
  );
}
