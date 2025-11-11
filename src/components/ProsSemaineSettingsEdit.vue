<template>
  <v-card title="Créneaux de la semaine">
    <v-card-text>
      <v-card subtitle="Réunion" class="my-2">
        <v-card-text>
          <template v-if="props.planning.reunion">
            {{
              computeDate(
                props.firstMonday,
                { week: props.planning.week, day: props.planning.reunion.day },
                props.planning.reunion.horaire
              ).toLocaleString("fr", {
                weekday: "long",
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            }}
          </template>
          <template v-else> Aucune réunion d'équipe cette semaine. </template>
        </v-card-text>
      </v-card>

      <v-card subtitle="Détachements" class="my-2">
        <v-card-text>
          <v-row
            v-for="(pro, index) in props.planning.prosHoraires"
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
                  v-model="inner[index].horaires.start"
                ></HoraireField>
              </v-col>
              <v-col>
                <HoraireField
                  label="Détachement (fin)"
                  v-model="inner[index].horaires.end"
                ></HoraireField>
              </v-col>
              <v-col align-self="center" cols="auto">
                <v-btn icon @click="inner[index] = null" size="small">
                  <v-icon color="red">mdi-delete</v-icon>
                </v-btn>
              </v-col>
            </template>
            <template v-else>
              <v-col>
                <v-btn
                  @click="
                    inner[index] = { dayIndex: 0, horaires: emptyRange() }
                  "
                  size="small"
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
      </v-card>
    </v-card-text>

    <v-card-actions>
      <v-btn @click="emit('save', inner)" :disabled="!isValid">
        Enregistrer</v-btn
      >
    </v-card-actions>
  </v-card>
</template>

<script lang="ts" setup>
import { computeDate, copy, emptyRange, rangeIncludes } from "@/logic/shared";
import { computed, ref } from "vue";
import HoraireField from "./HoraireField.vue";
import type { Detachement, WeekPros } from "@/logic/types";

const props = defineProps<{
  firstMonday: Date;
  planning: WeekPros;
}>();

const emit = defineEmits<{
  (e: "save", detachements: (Detachement | null)[]): void;
}>();

const inner = ref(copy(props.planning.prosHoraires.map((p) => p.detachement)));

const isValid = computed(() =>
  props.planning.prosHoraires.every((pro, index) => {
    const detachement = inner.value[index];
    if (!detachement) return true;
    return rangeIncludes(
      pro.horaires[detachement.dayIndex].presence,
      detachement.horaires
    );
  })
);
</script>

<style></style>
