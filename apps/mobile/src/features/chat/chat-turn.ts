import type { AssistantUIMessage } from "./stream";
import type { FilePart, ImageAttachment } from "./image-attachment";

export type ChatTurn = {
  message: AssistantUIMessage;
  attachments: ImageAttachment[];
};

/** Replace the next local image with the file part the server can receive. */
export function attachUploadedImage(turn: ChatTurn, file: FilePart): ChatTurn {
  const firstNonFile = turn.message.parts.findIndex((part) => part.type !== "file");
  const index = firstNonFile < 0 ? turn.message.parts.length : firstNonFile;
  const parts = [...turn.message.parts];
  parts.splice(index, 0, file);
  return {
    message: { ...turn.message, parts },
    attachments: turn.attachments.slice(1),
  };
}
