<template>
  <div style="width: 20px">
    <div :style="{ height: heights[0] + 'px' }"></div>
    <v-tooltip>
      <template #activator="{ props: tooltipProps }">
        <div
          v-bind="tooltipProps"
          :style="{
            height: heights[1] - heights[0] + 'px',
            backgroundColor: props.pro.color,
          }"
        ></div>
      </template>
      {{ props.pro.prenom }}
    </v-tooltip>

    <div :style="{ height: heights[2] - heights[1] + 'px' }"></div>
    <div
      :style="{
        height: heights[3] - heights[2] + 'px',
        backgroundColor: props.pro.color,
      }"
    ></div>
    <div :style="{ height: heights[4] - heights[3] + 'px' }"></div>
  </div>
</template>

<script lang="ts" setup>
import { TimeGrid } from "@/logic/check";
import type { HoraireTravail, Pro } from "@/logic/personnel";
import { computed } from "vue";

const props = defineProps<{
  pro: Pro;
  horaires: HoraireTravail;
}>();

const emit = defineEmits<{}>();

const heights = computed(() => {
  const stepHeight = 3; // in pixels
  const h1 = TimeGrid.horaireToIndex(props.horaires.presence.debut);
  const h2 = TimeGrid.horaireToIndex(props.horaires.pause.debut);
  const h3 = TimeGrid.horaireToIndex(props.horaires.pause.fin);
  const h4 = TimeGrid.horaireToIndex(props.horaires.presence.fin);
  return [
    h1 * stepHeight,
    h2 * stepHeight,
    h3 * stepHeight,
    h4 * stepHeight,
    TimeGrid.Length * stepHeight,
  ] as const;
});
</script>

<style></style>
