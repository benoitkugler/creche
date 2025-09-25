<template>
  <v-card title="Planning des pros">
    <template #append>
      <v-tabs v-model="displayedWeek">
        <v-tab
          v-for="week in props.planningPros.semaines"
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
    </template>
    <v-card-text>
      <v-tabs-window v-model="displayedWeek" class="mt-2">
        <v-tabs-window-item
          v-for="planningWeek in props.planningPros.semaines"
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
          ></ProsSemaineView>
        </v-tabs-window-item>
      </v-tabs-window>
    </v-card-text>
    <v-card-actions>
      <v-btn @click="emit('goBack')">
        <template #prepend>
          <v-icon>mdi-arrow-left</v-icon>
        </template>
        Retour</v-btn
      >
    </v-card-actions>
  </v-card>
</template>

<script lang="ts" setup>
import { type HoraireTravail, type PlanningPros } from "@/logic/personnel";
import { computeDate, type DayIndex, type int } from "@/logic/shared";
import { computed, ref } from "vue";
import ProsSemaineView from "./ProsSemaineView.vue";
import { TimeGrid, type Diagnostic } from "@/logic/check";
import type { PlanningChildren } from "@/logic/enfants";

const props = defineProps<{
  planningChildren: PlanningChildren;
  planningPros: PlanningPros;
}>();

const emit = defineEmits<{
  (e: "editHoraires", index: DayIndex, horaires: HoraireTravail[]): void;
  (e: "goBack"): void;
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

const diagnostics = computed(
  () =>
    //   check(props.planningChildren, props.planningPros)
    [
      {
        dayIndex: { week: 0, day: 1 },
        horaireIndex: TimeGrid.horaireToIndex({ heure: 13, minute: 40 }),
        check: {
          kind: 0,
          expect: 3,
          got: 1,
        },
      },

      {
        dayIndex: { week: 0, day: 1 },
        horaireIndex: TimeGrid.horaireToIndex({ heure: 13, minute: 40 }),
        check: {
          kind: 1,
          expect: 3,
          got: 1,
        },
      },
      {
        dayIndex: { week: 1, day: 1 },
        horaireIndex: TimeGrid.horaireToIndex({ heure: 13, minute: 40 }),
        check: {
          kind: 2,
          expect: 3,
          got: 1,
        },
      },
      {
        dayIndex: { week: 0, day: 2 },
        horaireIndex: TimeGrid.horaireToIndex({ heure: 13, minute: 40 }),
        check: {
          kind: 3,
          pro: { color: "", prenom: "SDLkslm L." },
          expectedLendemain: { heure: 12, minute: 15 },
          gotLendemain: { heure: 12, minute: 30 },
        },
      },
    ] satisfies Diagnostic[]
);

function diagnosticFor(week: int) {
  return diagnostics.value.filter((d) => d.dayIndex.week == week);
}
</script>

<style></style>
