import type { CheckIn, CreateIn } from "./types";

onmessage = async (e) => {
  const data = e.data as WorkerMessageData;
  const outJSON = await runWasmZigFunc(data.wasm, data.task, data.json);
  postMessage(outJSON);
};

export type WorkerMessageData = {
  wasm: WebAssembly.Module;
  task: keyof ZigWasmTasks;
  json: string;
};

export type ZigWasmTasks = {
  checkPlanningJSON: CheckIn;
  createPlanningJSON: CreateIn;
};

type WasmZigExports = {
  memory: WebAssembly.Memory;
  alloc: (len: number) => number;
  free: (ptr: number, len: number) => void;
  checkPlanningJSON: (ptr: number, len: number) => bigint;
  createPlanningJSON: (ptr: number, len: number) => bigint;
};

// returns JSON string
async function runWasmZigFunc<K extends keyof ZigWasmTasks>(
  module: WebAssembly.Module,
  task: K,
  inputJSON: string
) {
  const wasm = (await WebAssembly.instantiate(module))
    .exports as WasmZigExports;
  const { memory, alloc, free } = wasm;
  const fn = wasm[task];
  // convert JSON to utf-8
  const encoded = new TextEncoder().encode(inputJSON);
  // allocate ...
  const inLen = encoded.length;
  const inPtr = alloc(inLen);
  // ... and copy 'encoded' into the wasm allocated memory
  const tmp = new Uint8Array(memory.buffer, inPtr, inLen);
  tmp.set(encoded);
  // actually run the task (wasm side)
  const outAsU64 = fn(inPtr, inLen);
  const outPtr = Number(outAsU64 >> 32n);
  const outLen = Number(outAsU64 & 0xffffffffn);
  // convert back to JS using JSON
  const outputView = new Uint8Array(memory.buffer, outPtr, outLen);
  const output = new TextDecoder().decode(outputView);
  free(inPtr, inLen);
  free(outPtr, outLen);
  // free memory before returning
  return output;
}
