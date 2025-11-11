<template>
  <v-card
    title="Analyse du planning"
    subtitle="Démarrer une analyse en chargeant les fichiers Enfants et Pros."
  >
    <v-card-text>
      <v-row>
        <v-col>
          <v-file-input
            label="Planning des enfants"
            v-model="fileChildren"
            :multiple="false"
            accept="application/pdf"
          >
          </v-file-input>
        </v-col>
        <v-col>
          <v-file-input
            label="Planning des pros"
            v-model="filePros"
            :multiple="false"
            accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
          ></v-file-input>
        </v-col>
      </v-row>
      <v-row>
        <v-col>
          <v-file-input
            label="Roulement des pros (optionnel)"
            v-model="roulementPros"
            :multiple="false"
            accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          ></v-file-input>
        </v-col>
      </v-row>
    </v-card-text>
    <v-card-actions>
      <v-spacer></v-spacer>
      <v-btn :disabled="!fileChildren || !filePros" @click="importFiles"
        >Lancer l'analyse</v-btn
      >
    </v-card-actions>

    <v-dialog
      :model-value="error != ''"
      @update:model-value="error = ''"
      max-width="600px"
    >
      <v-card title="Lecture impossible">
        <v-card-text>{{ error }}</v-card-text>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { isError } from "@/logic/shared";
import { parseExcelPros } from "@/logic/pros";
import type { ChildrenPlanning, ProsPlanning, Roulements } from "@/logic/types";
import { parseExcelRoulements } from "@/logic/roulement";
import { Wasm } from "@/logic/wasm";

const props = defineProps<{}>();

const emit = defineEmits<{
  (
    e: "goNext",
    children: ChildrenPlanning,
    pros: ProsPlanning,
    roulements: Roulements | null
  ): void;
}>();

const fileChildren = ref<File | null>(null);
const filePros = ref<File | null>(null);
const roulementPros = ref<File | null>(null);

const error = ref("");

async function importFiles() {
  if (!fileChildren.value || !filePros.value) return;
  // Enfants
  const content = await fileChildren.value.arrayBuffer();
  const slice = new Uint8Array(content);
  const res1 = Wasm.parseChildrenPDFFile(slice);
  if (isError(res1)) {
    error.value = res1.err;
    return;
  }

  // Pros
  const res2 = await parseExcelPros(filePros.value, res1.firstMonday);
  if (isError(res2)) {
    error.value = res2.err;
    return;
  }

  let roulements: Roulements | null = null;
  if (roulementPros.value) {
    const res3 = await parseExcelRoulements(roulementPros.value);
    if (isError(res3)) {
      error.value = res3.err;
      return;
    }
    roulements = res3.roulements;
  }

  emit("goNext", res1, res2, roulements);
}
</script>

<style></style>
