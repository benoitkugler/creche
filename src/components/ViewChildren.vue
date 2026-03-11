<template>
  <v-card
    :title="`Planning des enfants - ${
      props.planning ? planningMonth(props.planning) : ''
    }`"
    :subtitle="`modifié le ${props.lastSave.toLocaleString()}`"
  >
    <template #append>
      <v-btn color="green" @click="showUploadDialog = true">
        <template #prepend>
          <v-icon>mdi-upload</v-icon>
        </template>
        Charger un planning
      </v-btn>
    </template>
    <v-card-text>
      <ChildrenCalendar
        v-if="props.planning"
        :planning="props.planning"
        @update="(p) => emit('update', p)"
      ></ChildrenCalendar>
    </v-card-text>

    <v-card-actions>
      <v-spacer></v-spacer>
      <v-btn @click="emit('goNext')">
        <template #append>
          <v-icon>mdi-arrow-right</v-icon>
        </template>
        Continuer</v-btn
      >
    </v-card-actions>

    <!-- file upload dialog -->
    <v-dialog v-model="showUploadDialog" max-width="600px">
      <v-card
        title="Charger un planning"
        subtitle="Choisir le fichier .PDF du mois souhaité."
      >
        <v-card-text>
          <v-file-input
            label="Planning des enfants"
            v-model="fileChildren"
            :multiple="false"
            accept="application/pdf"
            truncate-length="100"
          >
          </v-file-input>
          <v-alert type="warning" v-if="props.planning">
            Attention, le planning actuel sera remplacé.
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn @click="load">
            {{ props.planning ? "Charger et remplacer" : "Charger" }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

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
import { planningMonth } from "@/logic/children";
import type { ChildrenPlanning } from "@/logic/types";
import ChildrenCalendar from "./ChildrenCalendar.vue";
import { Wasm } from "@/logic/wasm";
import { isError } from "@/logic/shared";

const props = defineProps<{
  planning: ChildrenPlanning | null;
  lastSave: Date;
}>();

const emit = defineEmits<{
  (e: "update", planning: ChildrenPlanning): void;
  (e: "load", planning: ChildrenPlanning): void;
  (e: "goNext"): void;
}>();

const showUploadDialog = ref(false);
const fileChildren = ref<File | null>(null);
const error = ref("");
async function load() {
  if (!fileChildren.value) return;

  const content = await fileChildren.value.arrayBuffer();
  const slice = new Uint8Array(content);
  const res = Wasm.parseChildrenPDFFile(slice);
  if (isError(res)) {
    error.value = res.err;
    return;
  }
  showUploadDialog.value = false;
  emit("load", res);
}
</script>

<style></style>
