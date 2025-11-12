import { parseChildrenPDF, type TextBlock } from "./children";
import { type error, type int, newError } from "./shared";
import type {
  CheckIn,
  ChildrenPlanning,
  CreateIn,
  Diagnostic,
  ProsPlanning,
  Roulements,
} from "./types";
import "./wasm_exec";

/**
 * Go is the class as defined in the Golang `wasm_exec.js` distributable file required for WebAssembly.
 * Golang WebAssembly wiki: https://github.com/golang/go/wiki/WebAssembly
 */
declare class Go {
  argv: string[];
  env: { [envKey: string]: string };
  exit: (code: number) => void;
  importObject: WebAssembly.Imports;
  exited: boolean;
  mem: DataView;
  run(instance: WebAssembly.Instance): Promise<void>;
}

declare global {
  interface Window {
    // go function returning TextBlock[] as JSON string or an error
    readPDFFile(slice: Uint8Array): { error: string } | string;
  }
}

type WasmZigExports = {
  memory: WebAssembly.Memory;
  alloc: (len: number) => number;
  free: (ptr: number, len: number) => void;
  checkPlanningJSON: (ptr: number, len: number) => bigint;
  createPlanningJSON: (ptr: number, len: number) => bigint;
};

type wasmTasks = {
  checkPlanningJSON: CheckIn;
  createPlanningJSON: CreateIn;
};

export class WasmAPI {
  constructor(private wasmZig: WasmZigExports) {}

  static async init() {
    const result1 = await WebAssembly.instantiateStreaming(
      fetch("main_zig.wasm")
    );
    const wasmZig = result1.instance.exports as WasmZigExports;

    const go = new Go();
    const result2 = await WebAssembly.instantiateStreaming(
      fetch("main_go.wasm"),
      go.importObject
    );
    go.run(result2.instance);

    return new WasmAPI(wasmZig);
  }

  check(
    children: ChildrenPlanning,
    pros: ProsPlanning,
    roulements: Roulements | null
  ): Diagnostic[] {
    return JSON.parse(
      this.runWasmZigFunc("checkPlanningJSON", { children, pros, roulements })
    );
  }

  createPlanning(
    children: ChildrenPlanning,
    roulements: Roulements,
    firstWeekRoulement: int
  ): Diagnostic[] {
    return JSON.parse(
      this.runWasmZigFunc("createPlanningJSON", {
        children,
        roulements,
        firstWeekRoulement,
      })
    );
  }

  parseChildrenPDFFile(slice: Uint8Array): error | ChildrenPlanning {
    const pdfContent = window.readPDFFile(slice);

    if (typeof pdfContent == "object") {
      return newError(pdfContent.error);
    }

    const textsContents: TextBlock[] = JSON.parse(pdfContent);
    return parseChildrenPDF(textsContents);
  }

  // returns JSON string
  private runWasmZigFunc<K extends keyof wasmTasks>(
    task: K,
    input: wasmTasks[K]
  ) {
    const { memory, alloc, free } = this.wasmZig;
    const fn = this.wasmZig[task];
    // convert to JSON utf-8
    const encoded = new TextEncoder().encode(JSON.stringify(input));
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
}

export const Wasm = await WasmAPI.init();
