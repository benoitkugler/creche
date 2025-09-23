<template>
  <v-row justify="center" no-gutters>
    <v-col cols="auto">
      <ProsDayHorairesHeader></ProsDayHorairesHeader>
    </v-col>
    <v-col cols="auto">
      <ProsDayView
        :pros="byDay(0)"
        :day="
          computeDate(props.firstMonday, {
            week: props.planning.semaine,
            day: 0,
          })
        "
      ></ProsDayView>
    </v-col>
    <v-col cols="auto">
      <ProsDayView
        :pros="byDay(1)"
        :day="
          computeDate(props.firstMonday, {
            week: props.planning.semaine,
            day: 1,
          })
        "
      ></ProsDayView>
    </v-col>
    <v-col cols="auto">
      <ProsDayView
        :pros="byDay(2)"
        :day="
          computeDate(props.firstMonday, {
            week: props.planning.semaine,
            day: 2,
          })
        "
      ></ProsDayView>
    </v-col>
    <v-col cols="auto">
      <ProsDayView
        :pros="byDay(3)"
        :day="
          computeDate(props.firstMonday, {
            week: props.planning.semaine,
            day: 3,
          })
        "
      ></ProsDayView>
    </v-col>
    <v-col cols="auto">
      <ProsDayView
        :pros="byDay(4)"
        :day="
          computeDate(props.firstMonday, {
            week: props.planning.semaine,
            day: 4,
          })
        "
      ></ProsDayView>
    </v-col>

    <!-- diagnostics -->

    <v-col> TODO: Diagnostic </v-col>
  </v-row>
</template>

<script lang="ts" setup>
import { type PlanningProsSemaine } from "@/logic/personnel";
import ProsDayView from "./ProsDayView.vue";
import { computeDate, type int } from "@/logic/shared";
import ProsDayHorairesHeader from "./ProsDayHorairesHeader.vue";
import type { Diagnostic } from "typescript";

const props = defineProps<{
  firstMonday: Date;
  planning: PlanningProsSemaine;
}>();

const emit = defineEmits<{}>();

function byDay(day: int) {
  return props.planning.prosHoraires.map((pro) => ({
    pro: pro.pro,
    horaires: pro.horaires[day],
  }));
}
</script>

<style></style>
