import * as ImagePicker from "expo-image-picker";
import { ActionSheetIOS, Alert, Platform } from "react-native";
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
  Platform: { OS: "ios" },
  ActionSheetIOS: { showActionSheetWithOptions: vi.fn() },
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

describe("pickImageAttachments on iOS", () => {
  beforeEach(() => { Platform.OS = "ios"; });

  it("returns an image taken with the camera", async () => {
    const attachments = pickImageAttachments();
    vi.mocked(ActionSheetIOS.showActionSheetWithOptions).mock.calls[0]![1](0);

    await expect(attachments).resolves.toEqual([{
      uri: "file:///photo.jpg",
      mediaType: "image/jpeg",
    }]);
    expect(ImagePicker.launchCameraAsync).toHaveBeenCalledOnce();
  });

  it("returns every image selected from the library", async () => {
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [
        { uri: "file:///fridge.jpg", mimeType: "image/jpeg", width: 100, height: 100 },
        { uri: "file:///cupboard.png", mimeType: "image/png", width: 100, height: 100 },
      ],
    });
    const attachments = pickImageAttachments();
    vi.mocked(ActionSheetIOS.showActionSheetWithOptions).mock.calls[0]![1](1);

    await expect(attachments).resolves.toEqual([
      { uri: "file:///fridge.jpg", mediaType: "image/jpeg" },
      { uri: "file:///cupboard.png", mediaType: "image/png" },
    ]);
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith(
      expect.objectContaining({ allowsMultipleSelection: true }),
    );
  });

  it("treats cancellation as no attachment", async () => {
    const attachments = pickImageAttachments();
    vi.mocked(ActionSheetIOS.showActionSheetWithOptions).mock.calls[0]![1](2);

    await expect(attachments).resolves.toEqual([]);
  });

  it("reports denied camera permission without opening the camera", async () => {
    vi.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({
      granted: false,
      status: ImagePicker.PermissionStatus.DENIED,
      canAskAgain: false,
      expires: "never",
    });
    const attachments = pickImageAttachments();
    vi.mocked(ActionSheetIOS.showActionSheetWithOptions).mock.calls[0]![1](0);

    await expect(attachments).resolves.toEqual([]);
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledOnce();
  });

  it("lets the caller handle an unexpected picker failure", async () => {
    const error = new Error("Picker unavailable");
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockRejectedValue(error);
    const attachments = pickImageAttachments();
    vi.mocked(ActionSheetIOS.showActionSheetWithOptions).mock.calls[0]![1](1);

    await expect(attachments).rejects.toBe(error);
  });
});

describe("pickImageAttachments on Android", () => {
  beforeEach(() => { Platform.OS = "android"; });

  it.each([
    [0, ImagePicker.launchCameraAsync],
    [1, ImagePicker.launchImageLibraryAsync],
  ] as const)("returns the image chosen from source %i", async (index, picker) => {
    const attachments = pickImageAttachments();
    vi.mocked(Alert.alert).mock.calls[0]![2]![index]!.onPress!();

    await expect(attachments).resolves.toEqual([{
      uri: "file:///photo.jpg",
      mediaType: "image/jpeg",
    }]);
    expect(picker).toHaveBeenCalledOnce();
  });

  it("treats dismissing the source menu as cancellation", async () => {
    const attachments = pickImageAttachments();
    vi.mocked(Alert.alert).mock.calls[0]![3]!.onDismiss!();

    await expect(attachments).resolves.toEqual([]);
  });
});
