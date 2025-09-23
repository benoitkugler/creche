<template>
  <table class="pros-calendar-day-header">
    <tbody>
      <tr>
        <td style="height: 24px"></td>
      </tr>
      <tr v-for="(_, timeIndex) in TimeGrid.Length">
        <td
          v-if="timeIndex % 12 == 0"
          rowspan="12"
          :style="{
            padding: '0px 4px',
            height: '36px',
          }"
        >
          {{ formatHoraire(TimeGrid.indexToHoraire(timeIndex)) }}
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script lang="ts" setup>
import { TimeGrid } from "@/logic/check";
import { formatHoraire } from "@/logic/shared";

const props = defineProps<{}>();

const emit = defineEmits<{}>();
</script>

<style>
.pros-calendar-day-header {
  table-layout: fixed;
  border-collapse: collapse;
  margin: auto;
}

.pros-calendar-day-header td {
  border: 1px solid black;
  font-size: 10pt;
}
</style>
