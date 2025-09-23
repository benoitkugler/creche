<template>
  <v-card title="Planning des pros">
    <template #append>
      <v-tabs v-model="displayedWeek">
        <v-tab
          v-for="week in props.planning.semaines"
          :value="week.semaine"
          class="text-none"
        >
          {{ formatSemaine(week.semaine) }}
        </v-tab>
      </v-tabs>
    </template>
    <v-card-text>
      <v-tabs-window v-model="displayedWeek">
        <v-tabs-window-item
          v-for="week in props.planning.semaines"
          :value="week.semaine"
        >
          <ProsSemaineView
            :first-monday="props.planning.firstMonday"
            :planning="week"
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
import { type PlanningPros } from "@/logic/personnel";
import { computeDate, type int } from "@/logic/shared";
import { ref } from "vue";
import ProsSemaineView from "./ProsSemaineView.vue";

const props = defineProps<{ planning: PlanningPros }>();

const emit = defineEmits<{
  (e: "goBack"): void;
}>();

const displayedWeek = ref(0);

function formatSemaine(index: int) {
  const monday = computeDate(props.planning.firstMonday, {
    week: index,
    day: 0,
  });
  const friday = computeDate(props.planning.firstMonday, {
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
</script>

<style>
.my-table td,
th {
  border: 1px solid black;
  padding: 2px;
  font-size: 10pt;
}
</style>
