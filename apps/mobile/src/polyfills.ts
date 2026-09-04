import { TextDecoderStream, TextEncoderStream } from "@stardazed/streams-text-encoding";
import structuredClone from "@ungap/structured-clone";

// The AI SDK's stream reader needs these three; Hermes has none of them and
// web has all of them, so each is only defined when missing.
function define(name: string, value: unknown) {
  if (name in globalThis) return;
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

define("structuredClone", structuredClone);
define("TextEncoderStream", TextEncoderStream);
define("TextDecoderStream", TextDecoderStream);
