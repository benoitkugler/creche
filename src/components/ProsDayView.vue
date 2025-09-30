<template>
  <div :style="{ width: width }">
    <!-- horaires -->
    <div :style="{ position: 'absolute', width: width }">
      <div v-for="_ in TimeGrid.heures" class="horaire"></div>
    </div>

    <!-- color rects -->
    <div style="position: absolute; opacity: 0.8">
      <v-row no-gutters>
        <v-col v-for="pro in props.pros">
          <ProsDayProColumn
            :pro="pro.pro"
            :horaires="pro.horaires"
          ></ProsDayProColumn>
        </v-col>
      </v-row>
    </div>

    <!-- diagnostic marker -->
    <div v-if="props.diagnosticMark != null" style="position: absolute">
      <div :style="{ height: markerY }"></div>
      <div
        :style="{
          height: 1,
          width: width,
          'border-bottom': '4px solid orange',
        }"
      ></div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { TimeGrid } from "@/logic/check";
import type { HoraireTravail, Pro } from "@/logic/personnel";
import ProsDayProColumn from "./ProsDayProColumn.vue";
import { computed } from "vue";

const props = defineProps<{
  pros: { pro: Pro; horaires: HoraireTravail }[];
  diagnosticMark: TimeGrid.Index | null;
}>();

const emit = defineEmits<{}>();

const width = computed(() => props.pros.length * 20 + "px");

const markerY = computed(() => (props.diagnosticMark || 0) * 3 + "px");
</script>

<style>
.horaire {
  height: 36px;
  border: 1px solid gray;
  opacity: 0.8;
}
</style>
