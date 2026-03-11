<template>
  <v-card
    title="Modifier les horaires"
    :subtitle="`${props.child.nom} ${formatDay(
      props.firstMonday,
      props.dayIndex
    )}`"
  >
    <v-card-text>
      <v-row>
        <v-col>
          <HoraireField
            label="Arrivée"
            v-model="inner.horaires.start"
          ></HoraireField>
        </v-col>
        <v-col>
          <HoraireField
            label="Départ"
            v-model="inner.horaires.end"
          ></HoraireField>
        </v-col>
      </v-row>
      <v-row>
        <v-col>
          <v-checkbox
            label="Adaptation ?"
            v-model="inner.isAdaptation"
            density="compact"
            persistent-hint
            hint="Cocher pour demander une pro. attitrée à cet enfant."
          ></v-checkbox>
        </v-col>
      </v-row>
    </v-card-text>
    <v-card-actions>
      <v-btn
        color="red"
        prepend-icon="mdi-delete"
        @click="modelValue = null"
        :disabled="modelValue == null"
        >Supprimer la venue</v-btn
      >
      <v-spacer></v-spacer>
      <v-btn
        color="success"
        @click="modelValue = inner"
        :disabled="rangeIsEmpty(inner.horaires)"
        >Enregistrer</v-btn
      >
    </v-card-actions>
  </v-card>
</template>

<script lang="ts" setup>
import { copy, emptyRange, formatDay, rangeIsEmpty } from "@/logic/shared";
import type { Child, ChildDay, DayIndex } from "@/logic/types";
import HoraireField from "./HoraireField.vue";
import { ref } from "vue";

const props = defineProps<{
  child: Child;
  firstMonday: Date;
  dayIndex: DayIndex;
}>();

const modelValue = defineModel<ChildDay | null>({ required: true });

const inner = ref<ChildDay>(
  copy(modelValue.value || { horaires: emptyRange(), isAdaptation: false })
);
</script>

<style></style>
