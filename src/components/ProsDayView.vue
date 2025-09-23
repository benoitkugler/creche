<template>
  <table class="pros-calendar-day">
    <tbody>
      <tr>
        <td colspan="5" class="text-center" style="height: 24px">
          {{
            props.day.toLocaleDateString("fr", {
              weekday: "short",
              day: "2-digit",
              month: "short",
            })
          }}
        </td>
      </tr>
      <tr v-for="(_, timeIndex) in TimeGrid.Length">
        <td
          v-for="pro in props.pros"
          :style="{
            width: '30px',
            height: '3px',
            'background-color': TimeGrid.isIndexInHoraires(
              pro.horaires,
              timeIndex
            )
              ? '#' + pro.pro.color.slice(2)
              : '',
            'border-top': timeIndex % 12 == 0 ? '1px solid lightgrey' : '',
          }"
        ></td>
      </tr>
    </tbody>
  </table>
</template>

<script lang="ts" setup>
import { TimeGrid } from "@/logic/check";
import type { HoraireTravail, Pro } from "@/logic/personnel";

const props = defineProps<{
  day: Date;
  pros: { pro: Pro; horaires: HoraireTravail }[];
}>();

const emit = defineEmits<{}>();
</script>

<style>
.pros-calendar-day {
  table-layout: fixed;
  border-collapse: collapse;
  border: 1px solid black;
  margin: auto;
}

.pros-calendar-day td {
  border: 0px solid transparent;
  font-size: 10pt;
}
.pros-calendar-day tr {
  border: 0px solid transparent;
}
</style>
