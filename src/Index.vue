<template>
    <v-container>
        <v-card title="Analyse" subtitle="Démarrer une analyse en chargeant les fichiers Enfants et Pros">
            <v-card-text>
                <v-row>
                    <v-col>
                        <v-file-input label="Planning des enfants" v-model="fileChildren" :multiple="false"
                            accept="application/pdf">
                        </v-file-input>
                    </v-col>
                    <v-col>
                        <v-file-input label="Planning des pros" v-model="filePros" :multiple="false"
                            accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"></v-file-input>
                    </v-col>
                </v-row>
            </v-card-text>
            <v-card-actions>
                <v-spacer></v-spacer>
                <v-btn :disabled="!fileChildren || !filePros" @click="importFiles">Lancer l'analyse</v-btn>
            </v-card-actions>
        </v-card>
    </v-container>
</template>

<script lang="ts" setup>
import { ref, onMounted } from "vue"
import readXlsxFile from "read-excel-file";
import { Pros } from "@/logic/personnel"
import { Enfants } from "@/logic/enfants"
import { isError } from "@/logic/shared"
import "@/wasm_exec"

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

onMounted(initWasm)

const fileChildren = ref<File | null>(null)
const filePros = ref<File | null>(null)

async function importFiles() {
    if (!fileChildren.value || !filePros.value) return;
    // Enfants
    const content = await fileChildren.value.arrayBuffer()
    const slice = new Uint8Array(content)
    const textsContents: TextBlock[] = JSON.parse(window.readPDFFile(slice))
    const res1 = Enfants.parsePDFEnfants(textsContents)
    if (isError(res1)) {
        // TODO
    }
    console.log(res1);

    // Pros
    const rows = await readXlsxFile(filePros.value)
    const res2 = Pros.parseExcelPros(rows, new Date(2025, 4, 1))
    if (isError(res2)) {
        // TODO: 
        console.log(res2);

    }
    console.log(res2);

}

async function initWasm() {
    const go = new Go();
    const result = await WebAssembly.instantiateStreaming(
        fetch("main.wasm"),
        go.importObject
    )
    go.run(result.instance);
    console.log("OK");

}

function onClick() {
    const uint8 = new Uint8Array(2_000);
    uint8[1] = 56
    const out = JSON.parse(window.readPDFFile(uint8))
    console.log(out);
}
</script>
