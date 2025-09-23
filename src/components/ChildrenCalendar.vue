<template>
  <v-card
    title="Planning des enfants"
    :subtitle="`${month} ${firstDay.getFullYear()} - Les adaptations sont en orange.`"
  >
    <v-card-text>
      <table
        style="table-layout: fixed; border-collapse: collapse; margin: auto"
        class="my-table"
      >
        <tbody>
          <tr style="background-color: lightblue">
            <th style="width: 250px">Enfant</th>
            <th style="width: 80px">Marcheur ?</th>
            <th v-for="day in days" style="width: 40px">
              {{ formatDay(day) }}
            </th>
          </tr>
          <tr v-for="enfant in inner.enfants">
            <td>
              {{ enfant.enfant.nom }} <br />
              {{ enfant.enfant.dateNaissance.toLocaleDateString() }}
            </td>
            <td class="text-center">
              <v-checkbox-btn
                density="compact"
                inline
                :model-value="enfant.enfant.isMarcheur"
                @update:model-value="
                  (v) => {
                    enfant.enfant.isMarcheur = v;
                    emit('update', inner);
                  }
                "
              ></v-checkbox-btn>
            </td>
            <td
              v-for="day in days"
              :style="{
                'font-size': 'smaller',
                cursor:
                  enfant.creneaux[day.week][day.day] == null ? '' : 'pointer',
                'background-color': enfant.creneaux[day.week][day.day]
                  ?.isAdaptation
                  ? 'orange'
                  : '',
              }"
              class="text-center"
              @click="
                enfant.creneaux[day.week][day.day]!.isAdaptation =
                  !enfant.creneaux[day.week][day.day]!.isAdaptation;
                emit('update', inner);
              "
            >
              {{ formatHoraires(enfant.creneaux[day.week][day.day]) }}
            </td>
          </tr>
        </tbody>
      </table>
    </v-card-text>

    <v-card-actions>
      <v-btn @click="emit('goBack')">
        <template #prepend>
          <v-icon>mdi-arrow-left</v-icon>
        </template>
        Retour</v-btn
      >
      <v-spacer></v-spacer>
      <v-btn @click="emit('goNext')">
        <template #append>
          <v-icon>mdi-arrow-right</v-icon>
        </template>
        Continuer</v-btn
      >
    </v-card-actions>
  </v-card>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import {
  type CreneauEnfant,
  Children,
  type PlanningChildren,
  months,
} from "@/logic/enfants";
import {
  computeDate,
  copy,
  formatHoraire,
  type DayIndex,
} from "@/logic/shared";

const props = defineProps<{ planning: PlanningChildren }>();

const emit = defineEmits<{
  (e: "update", planning: PlanningChildren): void;
  (e: "goBack"): void;
  (e: "goNext"): void;
}>();

const inner = ref(copy(props.planning));

watch(
  () => props.planning,
  () => (inner.value = copy(props.planning))
);

const firstDay = computed(() => Children.firstDay(inner.value));

const month = computed(() => months[firstDay.value.getMonth()]!.toUpperCase());

const days = computed(() => {
  const out: DayIndex[] = [];
  const sCount = Children.semaineCount(inner.value);
  for (let week = 0; week < sCount; week++) {
    for (let day = 0; day < 5; day++) {
      out.push({ week, day });
    }
  }
  return out;
});

const weekDays = ["d", "l", "m", "m", "j", "v", "s"];

function formatDay(day: DayIndex) {
  const date = computeDate(inner.value.firstMonday, day);
  return `${weekDays[date.getDay()]} ${date
    .getDate()
    .toString()
    .padStart(2, "0")}`;
}

function formatHoraires(creneau: CreneauEnfant | null) {
  if (creneau === null) return "";
  return `${formatHoraire(creneau.horaires.debut)} ${formatHoraire(
    creneau.horaires.fin
  )}`;
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
