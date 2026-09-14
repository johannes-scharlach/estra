import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pickImageAttachments } from "./image-attachment";

vi.mock("expo-crypto", () => ({}));
vi.mock("@/lib/supabase", () => ({}));
vi.mock("expo-image-picker", () => ({
  PermissionStatus: { GRANTED: "granted", DENIED: "denied" },
  requestCameraPermissionsAsync: vi.fn(),
  launchCameraAsync: vi.fn(),
  launchImageLibraryAsync: vi.fn(),
}));
vi.mock("react-native", () => ({
  Alert: { alert: vi.fn() },
}));

const result: ImagePicker.ImagePickerResult = {
  canceled: false,
  assets: [{ uri: "file:///photo.jpg", mimeType: "image/jpeg", width: 100, height: 100 }],
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({
    granted: true,
    status: ImagePicker.PermissionStatus.GRANTED,
    canAskAgain: true,
    expires: "never",
  });
  vi.mocked(ImagePicker.launchCameraAsync).mockResolvedValue(result);
  vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue(result);
});

describe("pickImageAttachments", () => {
  it("returns an image taken with the camera", async () => {
    const attachments = pickImageAttachments("camera");

    await expect(attachments).resolves.toEqual([{
      uri: "file:///photo.jpg",
      mediaType: "image/jpeg",
    }]);
    expect(ImagePicker.launchCameraAsync).toHaveBeenCalledOnce();
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("returns every image selected from the library", async () => {
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [
        { uri: "file:///fridge.jpg", mimeType: "image/jpeg", width: 100, height: 100 },
        { uri: "file:///cupboard.png", mimeType: "image/png", width: 100, height: 100 },
      ],
    });
    const attachments = pickImageAttachments("library");

    await expect(attachments).resolves.toEqual([
      { uri: "file:///fridge.jpg", mediaType: "image/jpeg" },
      { uri: "file:///cupboard.png", mediaType: "image/png" },
    ]);
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ allowsMultipleSelection: true }),
    );
    expect(ImagePicker.requestCameraPermissionsAsync).not.toHaveBeenCalled();
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it.each(["camera", "library"] as const)("treats %s cancellation as no attachment", async (source) => {
    vi.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({ canceled: true, assets: null });
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({ canceled: true, assets: null });
    await expect(pickImageAttachments(source)).resolves.toEqual([]);
  });

  it("reports denied camera permission without opening the camera", async () => {
    vi.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({
      granted: false,
      status: ImagePicker.PermissionStatus.DENIED,
      canAskAgain: false,
      expires: "never",
    });
    const attachments = pickImageAttachments("camera");

    await expect(attachments).resolves.toEqual([]);
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledOnce();
  });

  it("lets the caller handle an unexpected picker failure", async () => {
    const error = new Error("Picker unavailable");
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockRejectedValue(error);
    const attachments = pickImageAttachments("library");

    await expect(attachments).rejects.toBe(error);
  });
});
