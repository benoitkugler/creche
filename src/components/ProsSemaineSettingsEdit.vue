<template>
  <v-card title="Réunion et détachements">
    <v-card-text>
      <v-card subtitle="Réunion" class="my-2">
        <v-card-text>
          <template v-if="inner.reunion">
            <v-row>
              <v-col>
                <DayField v-model="inner.reunion.day"></DayField>
              </v-col>
              <v-col>
                <HoraireField
                  label="Début"
                  v-model="inner.reunion.horaire"
                ></HoraireField>
              </v-col>
              <v-col cols="auto" align-self="center">
                <v-btn icon @click="inner.reunion = null" size="small">
                  <v-icon color="red">mdi-delete</v-icon>
                </v-btn>
              </v-col>
            </v-row>
          </template>
          <template v-else>
            <v-row justify="space-between">
              <v-col> Aucune réunion d'équipe cette semaine. </v-col>
              <v-col cols="auto">
                <v-btn size="small" prepend-icon="mdi-plus" @click="addReunion"
                  >Ajouter une réunion</v-btn
                >
              </v-col>
            </v-row>
          </template>
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
            <template v-if="inner.detachements[index]">
              <v-col>
                <DayField
                  v-model="inner.detachements[index].dayIndex"
                ></DayField>
              </v-col>
              <v-col>
                <HoraireField
                  label="Détachement (début)"
                  v-model="inner.detachements[index].horaires.start"
                ></HoraireField>
              </v-col>
              <v-col>
                <HoraireField
                  label="Détachement (fin)"
                  v-model="inner.detachements[index].horaires.end"
                ></HoraireField>
              </v-col>
              <v-col align-self="center" cols="auto">
                <v-btn
                  icon
                  @click="inner.detachements[index] = null"
                  size="small"
                >
                  <v-icon color="red">mdi-delete</v-icon>
                </v-btn>
              </v-col>
            </template>
            <template v-else>
              <v-col cols="auto">
                <v-btn
                  @click="
                    inner.detachements[index] = {
                      dayIndex: 0,
                      horaires: emptyRange(),
                    }
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
      <v-btn
        @click="emit('save', inner.reunion, inner.detachements)"
        :disabled="!isValid"
      >
        Enregistrer</v-btn
      >
    </v-card-actions>
  </v-card>
</template>

<script lang="ts" setup>
import { computeDate, copy, emptyRange, rangeIncludes } from "@/logic/shared";
import { computed, ref } from "vue";
import HoraireField from "./HoraireField.vue";
import type { Detachement, Reunion, WeekPros } from "@/logic/types";
import DayField from "./DayField.vue";

const props = defineProps<{
  firstMonday: Date;
  planning: WeekPros;
}>();

const emit = defineEmits<{
  (
    e: "save",
    reunion: Reunion | null,
    detachements: (Detachement | null)[]
  ): void;
}>();

const inner = ref({
  reunion: props.planning.reunion,
  detachements: copy(props.planning.prosHoraires.map((p) => p.detachement)),
});

const isValid = computed(() =>
  props.planning.prosHoraires.every((pro, index) => {
    const detachement = inner.value.detachements[index];
    if (!detachement) return true;
    return rangeIncludes(
      pro.horaires[detachement.dayIndex].presence,
      detachement.horaires
    );
  })
);

function addReunion() {
  inner.value.reunion = { day: 1, horaire: { heure: 13, minute: 30 } };
}
</script>

<style></style>
