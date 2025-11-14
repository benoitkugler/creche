import { parseChildrenPDF, type TextBlock } from "./children";
import { type error, fromJson, type int, newError } from "./shared";
import type {
  ChildrenPlanning,
  CreateOut,
  Diagnostic,
  ProsPlanning,
  Roulements,
  RoulementsAndPros,
} from "./types";
import "./wasm_exec";
import type { WorkerMessageData, ZigWasmTasks } from "./wasm_worker";

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

export class WasmAPI {
  constructor(private wasmZig: WebAssembly.Module) {}

  static async init() {
    const wasmZig = await WebAssembly.compileStreaming(fetch("main_zig.wasm"));

    const go = new Go();
    const result2 = await WebAssembly.instantiateStreaming(
      fetch("main_go.wasm"),
      go.importObject
    );
    go.run(result2.instance);

    return new WasmAPI(wasmZig);
  }

  async check(
    children: ChildrenPlanning,
    pros: ProsPlanning,
    roulements: Roulements | null
  ): Promise<Diagnostic[]> {
    const json = await this.runZigWasmWorker("checkPlanningJSON", {
      children,
      pros,
      roulements,
    });
    return fromJson(json);
  }

  async createPlanning(
    children: ChildrenPlanning,
    roulements: RoulementsAndPros,
    firstWeekRoulement: int
  ) {
    const jsonOut = await this.runZigWasmWorker("createPlanningJSON", {
      children,
      roulements,
      firstWeekRoulement,
    });

    const out: CreateOut = fromJson(jsonOut);
    if ("err" in out) {
      return newError(out.err);
    } else {
      return out.done;
    }
  }

  parseChildrenPDFFile(slice: Uint8Array): error | ChildrenPlanning {
    const pdfContent = window.readPDFFile(slice);

    if (typeof pdfContent == "object") {
      return newError(pdfContent.error);
    }

    const textsContents: TextBlock[] = JSON.parse(pdfContent);
    return parseChildrenPDF(textsContents);
  }

  // launch wasm in a web worker and returns a JSON string
  private async runZigWasmWorker<K extends keyof ZigWasmTasks>(
    task: K,
    input: ZigWasmTasks[K]
  ) {
    const worker = new Worker(new URL("wasm_worker.js", import.meta.url));
    const message: WorkerMessageData = {
      wasm: this.wasmZig,
      task,
      json: JSON.stringify(input),
    };

    const p = new Promise<string>((resolve, _) => {
      // setup message
      worker.onmessage = (ev) => {
        resolve(ev.data);
      };
      // launch background work
      worker.postMessage(message);
    });

    return p;
  }
}

export const Wasm = await WasmAPI.init();
