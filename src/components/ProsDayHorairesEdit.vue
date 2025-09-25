<template>
  <v-card title="Modifier les horaires">
    <v-card-text>
      <v-row
        v-for="(pro, index) in props.pros"
        :style="{ 'background-color': pro.pro.color }"
        class="rounded my-1"
      >
        <v-col>
          {{ pro.pro.prenom }}
        </v-col>
        <v-col>
          <HoraireField
            label="Arrivée"
            v-model="inner[index].presence.debut"
          ></HoraireField>
        </v-col>
        <v-col>
          <HoraireField
            label="Départ"
            v-model="inner[index].presence.fin"
          ></HoraireField>
        </v-col>
        <v-divider vertical thickness="4"></v-divider>
        <v-col>
          <HoraireField
            label="Pause (début)"
            v-model="inner[index].pause.debut"
          ></HoraireField>
        </v-col>
        <v-col>
          <HoraireField
            label="Pause (fin)"
            v-model="inner[index].pause.fin"
          ></HoraireField>
        </v-col>
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
import { type HoraireTravail, type Pro } from "@/logic/personnel";
import { copy } from "@/logic/shared";
import { computed, ref } from "vue";
import HoraireField from "./HoraireField.vue";

const props = defineProps<{
  pros: { pro: Pro; horaires: HoraireTravail }[];
}>();

const emit = defineEmits<{
  (e: "save", horaires: HoraireTravail[]): void;
}>();

const inner = ref(copy(props.pros.map((p) => p.horaires)));

const isValid = computed(() =>
  inner.value.every((hs) => hs.presence.includes(hs.pause))
);
</script>

<style></style>
