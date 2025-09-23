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
    </v-card-text>
    <v-card-actions>
      <v-spacer></v-spacer>
      <v-btn :disabled="!fileChildren || !filePros" @click="importFiles"
        >Lancer l'analyse</v-btn
      >
    </v-card-actions>

    <v-snackbar v-model="showSuccess" :timeout="3000" color="green">
      Fichiers importés avec succès.
    </v-snackbar>

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
import {
  Enfants,
  type PlanningChildren,
  type TextBlock,
} from "@/logic/enfants";
import { isError } from "@/logic/shared";
import readXlsxFile from "read-excel-file";
import { Pros, type PlanningPros } from "@/logic/personnel";

const props = defineProps<{}>();

const emit = defineEmits<{
  (e: "goNext", children: PlanningChildren, pros: PlanningPros): void;
}>();

const fileChildren = ref<File | null>(null);
const filePros = ref<File | null>(null);

const error = ref("");
const showSuccess = ref(false);

async function importFiles() {
  if (!fileChildren.value || !filePros.value) return;
  // Enfants
  const content = await fileChildren.value.arrayBuffer();
  const slice = new Uint8Array(content);
  const textsContents: TextBlock[] = JSON.parse(window.readPDFFile(slice));
  const res1 = Enfants.parsePDFEnfants(textsContents);
  if (isError(res1)) {
    error.value = res1.err;
    return;
  }

  // Pros
  const rows = await readXlsxFile(filePros.value);
  console.log(res1.firstMonday);

  const res2 = Pros.parseExcelPros(rows, res1.firstMonday);
  if (isError(res2)) {
    error.value = res2.err;
    return;
  }
  showSuccess.value = true;
  emit("goNext", res1, res2);
}
</script>

<style></style>
