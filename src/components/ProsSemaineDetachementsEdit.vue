<template>
  <v-card title="Modifier les détachements">
    <v-card-text>
      <v-row
        v-for="(pro, index) in props.pros"
        :style="{ 'background-color': pro.pro.color }"
        class="rounded my-1"
      >
        <v-col align-self="center">
          {{ pro.pro.prenom }}
        </v-col>
        <template v-if="inner[index]">
          <v-col>
            <v-select
              label="Jour de la semaine"
              :items="[
                { title: 'Lundi', value: 0 },
                { title: 'Mardi', value: 1 },
                { title: 'Mercredi', value: 2 },
                { title: 'Jeudi', value: 3 },
                { title: 'Vendredi', value: 4 },
              ]"
              v-model="inner[index].dayIndex"
              hide-details
            ></v-select>
          </v-col>
          <v-col>
            <HoraireField
              label="Détachement (début)"
              v-model="inner[index].horaires.debut"
            ></HoraireField>
          </v-col>
          <v-col>
            <HoraireField
              label="Détachement (fin)"
              v-model="inner[index].horaires.fin"
            ></HoraireField>
          </v-col>
          <v-col align-self="center" cols="auto">
            <v-btn icon @click="inner[index] = undefined" size="small">
              <v-icon color="red">mdi-delete</v-icon>
            </v-btn>
          </v-col>
        </template>
        <template v-else>
          <v-col>
            <v-btn
              @click="inner[index] = { dayIndex: 0, horaires: Range.empty() }"
            >
              <template #prepend>
                <v-icon color="green">mdi-plus</v-icon>
              </template>
              Ajouter un détachement
            </v-btn>
          </v-col>
        </template>
      </v-row>
    </v-card-text>
    <v-card-actions>
      <v-btn @click="emit('save', inner)" :disabled="!isValid">
        Enregistrer</v-btn
      >
    </v-card-actions>
  </v-card>
</template>

<script lang="ts" setup>
import { type Detachement, type SemainePro } from "@/logic/personnel";
import { copy, Range } from "@/logic/shared";
import { computed, ref } from "vue";
import HoraireField from "./HoraireField.vue";

const props = defineProps<{
  pros: SemainePro[];
}>();

const emit = defineEmits<{
  (e: "save", detachements: (Detachement | undefined)[]): void;
}>();

const inner = ref(copy(props.pros.map((p) => p.detachement)));

const isValid = computed(() =>
  props.pros.every((pro, index) => {
    const detachement = inner.value[index];
    if (!detachement) return true;
    return pro.horaires[detachement.dayIndex].presence.includes(
      detachement.horaires
    );
  })
);
</script>

<style></style>
