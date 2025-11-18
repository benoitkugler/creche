<template>
  <v-card
    title="Planning des pros"
    :subtitle="planningMonth(props.planningChildren)"
  >
    <template #append>
      <v-btn @click="showSelectTask = true"> Choisir une tâche </v-btn>
      <v-divider vertical thickness="2" class="mx-1"></v-divider>
      <v-btn prepend-icon="mdi-download" @click="exportPlanning"
        >Télécharger</v-btn
      >
    </template>
    <v-card-text>
      <ProsCalendar
        v-if="props.planningPros"
        :planning-children="props.planningChildren"
        :planning-pros="props.planningPros"
        :roulements="props.roulements"
        @edit-detachements="(w, d) => emit('editDetachements', w, d)"
        @edit-horaires="(i, h) => emit('editHoraires', i, h)"
      ></ProsCalendar>
    </v-card-text>
    <v-card-actions>
      <v-btn @click="emit('goBack')">
        <template #prepend>
          <v-icon>mdi-arrow-left</v-icon>
        </template>
        Retour</v-btn
      >
    </v-card-actions>

    <v-dialog v-model="showSelectTask">
      <TaskChoice
        :first-monday="props.planningChildren.firstMonday"
        @check-planning="checkPlanning"
        @create-planning="createPlanning"
      ></TaskChoice>
    </v-dialog>

    <v-dialog v-model="showCreateLoader" persistent max-width="800px">
      <v-card title="Création du planning">
        <v-card-text>
          <v-progress-linear
            indeterminate
            v-if="errCreate == ''"
          ></v-progress-linear>

          <v-alert type="warning" v-if="errCreate"
            >{{ errCreate }}
            <template #append>
              <v-btn
                @click="
                  errCreate = '';
                  showCreateLoader = false;
                  showSelectTask = true;
                "
                >Ré-essayer</v-btn
              >
            </template>
          </v-alert>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script lang="ts" setup>
import { isError, type error, type int } from "@/logic/shared";
import { onMounted, ref } from "vue";
import type {
  ChildrenPlanning,
  DayIndex,
  Detachement,
  HoraireTravail,
  ProsPlanning,
  Roulements,
} from "@/logic/types";
import TaskChoice from "./TaskChoice.vue";
import ProsCalendar from "./ProsCalendar.vue";
import { planningMonth } from "@/logic/children";
import { Wasm } from "@/logic/wasm";
import type { ParsedRoulements } from "@/logic/roulement";
import { writeExcelPros } from "@/logic/pros";

const props = defineProps<{
  planningChildren: ChildrenPlanning;
  planningPros: ProsPlanning | null;
  roulements: Roulements | null;
}>();

onMounted(() => {
  // start with task screen
  if (!props.planningPros) {
    showSelectTask.value = true;
  }
});

const emit = defineEmits<{
  (
    e: "update",
    planningPros: ProsPlanning,
    roulements: Roulements | null
  ): void;
  (e: "editHoraires", index: DayIndex, horaires: HoraireTravail[]): void;
  (
    e: "editDetachements",
    week: int,
    detachements: (Detachement | null)[]
  ): void;

  (e: "goBack"): void;
}>();

const showSelectTask = ref(false);

function checkPlanning(pros: ProsPlanning, roulements: Roulements | null) {
  showSelectTask.value = false;
  emit("update", pros, roulements);
}

const showCreateLoader = ref(false);
const errCreate = ref("");
async function createPlanning(
  roulements: ParsedRoulements,
  firstWeekRoulement: number
) {
  showSelectTask.value = false;
  showCreateLoader.value = true;

  const p1 = new Promise((r) => setTimeout(r, 500)); // so that dialog displays properly
  const p2 = Wasm.createPlanning(
    props.planningChildren,
    roulements,
    firstWeekRoulement
  );

  const [_, created] = await Promise.all([p1, p2]);

  if (isError(created)) {
    errCreate.value = created.err;
  } else {
    showCreateLoader.value = false;
    emit("update", created, roulements.roulements);
  }
}

async function exportPlanning() {
  if (!props.planningPros) return;
  const buffer = await writeExcelPros(
    props.planningPros,
    planningMonth(props.planningChildren)
  );
  saveBuffer(
    buffer,
    `Planning équipe ${planningMonth(props.planningChildren)}.xlsx`
  );
}

function saveBuffer(data: ArrayBuffer, fileName: string) {
  const a = document.createElement("a");
  document.body.appendChild(a);
  a.setAttribute("style", "display: none");
  const blob = new Blob([data], { type: "octet/stream" }),
    url = window.URL.createObjectURL(blob);
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
}
</script>

<style></style>
