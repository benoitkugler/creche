<template>
  <table
    style="table-layout: fixed; border-collapse: collapse; margin: auto"
    class="my-table"
  >
    <tbody>
      <tr style="background-color: lightblue">
        <th style="width: 200px">Enfant</th>
        <th style="width: 80px">Marcheur ?</th>
        <th v-for="day in days" style="width: 40px">
          {{ formatDay(inner.firstMonday, day) }}
        </th>
      </tr>
      <tr v-for="enfant in inner.children">
        <td>
          {{ enfant.child.nom }} <br />
          {{ enfant.child.dateNaissance }}
        </td>
        <td class="text-center">
          <v-checkbox-btn
            density="compact"
            inline
            :model-value="enfant.child.isMarcheur"
            @update:model-value="
                  (v) => {
                    enfant.child.isMarcheur = v;
                    emit('update', inner!);
                  }
                "
          ></v-checkbox-btn>
        </td>
        <td
          v-for="day in days"
          :style="{
            'font-size': 'smaller',
            cursor: 'pointer',
            'background-color': enfant.creneaux[day.week][day.day]?.isAdaptation
              ? 'orange'
              : '',
          }"
          class="text-center"
          @click="toEdit = { enfant, day }"
        >
          {{ formatHoraires(enfant.creneaux[day.week][day.day]) }}
        </td>
      </tr>
    </tbody>

    <v-dialog
      :model-value="toEdit != null"
      @update:model-value="toEdit = null"
      max-width="600px"
    >
      <ChildrenDayEdit
        v-if="toEdit"
        :child="toEdit.enfant.child"
        :first-monday="inner.firstMonday"
        :day-index="toEdit.day"
        :model-value="toEdit.enfant.creneaux[toEdit.day.week][toEdit.day.day]"
        @update:model-value="(v: ChildDay|null) => {toEdit!.enfant.creneaux[toEdit!.day.week][toEdit!.day.day] = v; toEdit = null; emit('update', inner)}"
      ></ChildrenDayEdit>
    </v-dialog>
  </table>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { copy, formatDay, formatHoraire } from "@/logic/shared";
import type {
  ChildCreneaux,
  ChildDay,
  ChildrenPlanning,
  DayIndex,
} from "@/logic/types";
import ChildrenDayEdit from "./ChildrenDayEdit.vue";

const props = defineProps<{ planning: ChildrenPlanning }>();

const emit = defineEmits<{
  (e: "update", planning: ChildrenPlanning): void;
}>();

const inner = ref(copy(props.planning));

watch(
  () => props.planning,
  () => (inner.value = copy(props.planning))
);

const days = computed(() => {
  const out: DayIndex[] = [];
  const sCount = inner.value.weekCount;
  for (let week = 0; week < sCount; week++) {
    for (let day = 0; day < 5; day++) {
      out.push({ week, day });
    }
  }
  return out;
});

function formatHoraires(creneau: ChildDay | null) {
  if (creneau === null) return "";
  return `${formatHoraire(creneau.horaires.start)} ${formatHoraire(
    creneau.horaires.end
  )}`;
}

const toEdit = ref<{ enfant: ChildCreneaux; day: DayIndex } | null>(null);
</script>

<style>
.my-table td,
th {
  border: 1px solid black;
  padding: 2px;
  font-size: 8pt;
}
</style>
