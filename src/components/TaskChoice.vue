<template>
  <v-card
    title="Choisir la tâche"
    subtitle="Vous pouvez vérifier un planning existant ou en construire un."
  >
    <v-card-text>
      <v-row>
        <v-col align-self="center">
          <v-card subtitle="Vérifier un planning">
            <v-card-text>
              <v-row>
                <v-col>
                  <v-file-input
                    label="Planning des pros"
                    v-model="filePros"
                    :multiple="false"
                    accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    truncate-length="100"
                  ></v-file-input>
                </v-col>
              </v-row>
              <v-row>
                <v-col>
                  <v-file-input
                    label="Roulement des pros (optionnel)"
                    v-model="fileRoulements"
                    :multiple="false"
                    accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    truncate-length="100"
                  ></v-file-input>
                </v-col>
              </v-row>
            </v-card-text>
            <v-card-actions>
              <v-btn
                block
                :disabled="!filePros"
                variant="outlined"
                @click="check"
                >Vérifier</v-btn
              >
            </v-card-actions>
          </v-card>
        </v-col>
        <v-col cols="auto">
          <v-divider vertical :thickness="2">ou</v-divider>
        </v-col>
        <v-col align-self="center">
          <v-card subtitle="Générer un planning">
            <v-card-text>
              <v-row>
                <v-col>
                  <v-file-input
                    label="Roulement des pros"
                    v-model="fileRoulements"
                    :multiple="false"
                    accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    truncate-length="100"
                  ></v-file-input>
                </v-col>
              </v-row>
              <v-row>
                <v-col>
                  <v-select
                    :items="[1, 2, 3, 4, 5, 6]"
                    v-model="firstRoulement"
                    label="Première semaine du mois"
                    hint="Indiquer sur quelle semaine (de roulement) commencer le mois."
                  ></v-select>
                </v-col>
              </v-row>
            </v-card-text>
            <v-card-actions>
              <v-btn
                block
                :disabled="!fileRoulements"
                variant="outlined"
                @click="create"
                >Générer</v-btn
              >
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </v-card-text>

    <v-dialog
      :model-value="error != ''"
      @update:model-value="error = ''"
      max-width="600px"
    >
      <v-card title="Erreur">
        <v-card-text>{{ error }}</v-card-text>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import type { ProsPlanning, Roulements } from "@/logic/types";
import { isError } from "@/logic/shared";
import { parseExcelPros } from "@/logic/pros";
import { parseExcelRoulements, type ParsedRoulements } from "@/logic/roulement";

const props = defineProps<{ firstMonday: Date }>();

const emit = defineEmits<{
  (
    e: "check-planning",
    prosPlanning: ProsPlanning,
    roulements: Roulements | null
  ): void;
  (
    e: "create-planning",
    roulements: ParsedRoulements,
    firstRoulement: number
  ): void;
}>();

const filePros = ref<File | null>(null);
const fileRoulements = ref<File | null>(null);

const error = ref("");

async function check() {
  if (!filePros.value) return;

  // Pros
  const planningPros = await parseExcelPros(filePros.value, props.firstMonday);
  console.log(planningPros, isError(planningPros));

  if (isError(planningPros)) {
    error.value = planningPros.err;
    return;
  }

  let roulements: Roulements | null = null;
  if (fileRoulements.value) {
    const resR = await parseExcelRoulements(fileRoulements.value);
    if (isError(resR)) {
      error.value = resR.err;
      return;
    }
    roulements = resR.roulements;
  }
  emit("check-planning", planningPros, roulements);
}

const firstRoulement = ref(1);
async function create() {
  if (!fileRoulements.value) return;

  const resR = await parseExcelRoulements(fileRoulements.value);
  if (isError(resR)) {
    error.value = resR.err;
    return;
  }

  const firstRoulementIndex = firstRoulement.value - 1;
  if (firstRoulementIndex >= resR.roulements.weeks.length) {
    error.value = "Le numéro du premier roulement est invalide.";
  }
  emit("create-planning", resR, firstRoulementIndex);
}
</script>

<style></style>
