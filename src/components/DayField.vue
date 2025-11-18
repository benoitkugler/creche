<template>
  <v-select
    label="Jour de la semaine"
    :items="[
      { title: 'Lundi', value: 0 },
      { title: 'Mardi', value: 1 },
      { title: 'Mercredi', value: 2 },
      { title: 'Jeudi', value: 3 },
      { title: 'Vendredi', value: 4 },
    ]"
    v-model="modelValue"
    hide-details
  ></v-select>
</template>

<script lang="ts" setup>
import { type int } from "@/logic/shared";

const props = defineProps<{}>();

const modelValue = defineModel<int>({ required: true });
</script>

<style></style>
