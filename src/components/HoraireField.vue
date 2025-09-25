<template>
  <v-text-field
    :label="props.label"
    hide-details
    readonly
    :model-value="formatHoraire(modelValue)"
  >
    <v-menu
      :close-on-content-click="false"
      activator="parent"
      min-width="0"
      v-model="showMenu"
    >
      <v-time-picker
        format="24hr"
        hide-header
        :allowed-hours="(h) => isHeure(h) != null"
        :allowed-minutes="(m) => m % 5 === 0"
        :model-value="formatHoraire(modelValue)"
        @update:hour="(h) => (modelValue.heure = h as Heure)"
        @update:minute="m => {
            modelValue.minute = m as Minute;
            showMenu = false;
        }"
      ></v-time-picker>
    </v-menu>
  </v-text-field>
</template>

<script lang="ts" setup>
import {
  formatHoraire,
  isHeure,
  type Heure,
  type Horaire,
  type Minute,
} from "@/logic/shared";
import { ref } from "vue";

const props = defineProps<{
  label: string;
}>();

const modelValue = defineModel<Horaire>({ required: true });

const showMenu = ref(false);
</script>

<style></style>
