<template>
  <div>
    <v-tabs v-model="displayedWeek" grow>
      <v-tab
        v-for="week in props.planningPros.weeks"
        :value="week.week"
        class="text-none"
      >
        {{ formatSemaine(week.week) }}
        <v-badge
          v-if="diagnosticFor(week.week).length"
          color="warning"
          :content="diagnosticFor(week.week).length"
          inline
        ></v-badge>
      </v-tab>
    </v-tabs>
    <v-tabs-window v-model="displayedWeek" class="mt-2">
      <v-tabs-window-item
        v-for="planningWeek in props.planningPros.weeks"
        :value="planningWeek.week"
      >
        <ProsSemaineView
          :first-monday="props.planningPros.firstMonday"
          :planning="planningWeek"
          :diagnostics="diagnosticFor(planningWeek.week)"
          @edit-horaires="
            (d, v) =>
              emit('editHoraires', { week: planningWeek.week, day: d }, v)
          "
          @edit-misc="(r, d) => emit('editMisc', planningWeek.week, r, d)"
        ></ProsSemaineView>
      </v-tabs-window-item>
    </v-tabs-window>
  </div>
</template>

<script lang="ts" setup>
import { computeDate, type int } from "@/logic/shared";
import { ref, watch } from "vue";
import ProsSemaineView from "./ProsSemaineView.vue";
import type {
  ChildrenPlanning,
  DayIndex,
  Detachement,
  Diagnostic,
  HoraireTravail,
  ProsPlanning,
  Reunion,
  Roulements,
} from "@/logic/types";
import { Wasm } from "@/logic/wasm";

const props = defineProps<{
  planningChildren: ChildrenPlanning;
  planningPros: ProsPlanning;
  roulements: Roulements | null;
}>();

const emit = defineEmits<{
  (e: "editHoraires", index: DayIndex, horaires: HoraireTravail[]): void;
  (
    e: "editMisc",
    week: int,
    reunion: Reunion | null,
    detachements: (Detachement | null)[]
  ): void;
}>();

const displayedWeek = ref(0);

function formatSemaine(index: int) {
  const monday = computeDate(props.planningPros.firstMonday, {
    week: index,
    day: 0,
  });
  const friday = computeDate(props.planningPros.firstMonday, {
    week: index,
    day: 4,
  });
  return `du ${monday.toLocaleDateString("fr", {
    day: "2-digit",
    month: "2-digit",
  })} au ${friday.toLocaleDateString("fr", {
    day: "2-digit",
    month: "2-digit",
  })}`;
}

const diagnostics = ref<Diagnostic[]>([]);

watch(
  () => props.planningPros,
  async () => {
    diagnostics.value = await computeChecks();
  },
  { immediate: true, deep: true }
);

async function computeChecks() {
  return Wasm.check(
    props.planningChildren,
    props.planningPros,
    props.roulements
  );
}

function diagnosticFor(week: int) {
  return diagnostics.value.filter((d) => d.dayIndex.week == week);
}
</script>

<style></style>
