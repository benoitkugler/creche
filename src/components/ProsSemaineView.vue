<template>
  <v-row justify="center" no-gutters class="mt-1">
    <v-col>
      <table style="border-collapse: collapse">
        <tbody>
          <!-- header -->
          <tr class="text-center">
            <td style="height: 32px">
              <v-btn size="x-small" flat @click="showEditCreneaux = true">
                <template #append>
                  <v-icon>mdi-pencil</v-icon>
                </template>
                Créneaux</v-btn
              >
            </td>
            <!-- jours -->
            <td v-for="(_, dayIndex) in 5">
              <v-btn
                size="x-small"
                flat
                @click="dayToEdit = dayIndex"
                class="my-auto"
              >
                <template #append>
                  <v-icon>mdi-pencil</v-icon>
                </template>
                {{
                  computeDate(props.firstMonday, {
                    week: props.planning.week,
                    day: dayIndex,
                  }).toLocaleDateString("fr", {
                    weekday: "short",
                    day: "2-digit",
                  })
                }}
              </v-btn>
            </td>
          </tr>

          <!-- contenu -->
          <tr v-for="(heure, rowIndex) in TimeGrid.heures">
            <!-- horaires -->
            <td
              :style="{
                height: '36px',
                border: '1px solid black',
              }"
              class="text-center"
            >
              {{ formatHoraire({ heure: heure, minute: 0 }) }}
            </td>

            <!-- journée -->
            <td
              v-for="(_, dayIndex) in 5"
              :rowspan="TimeGrid.heures.length"
              v-if="rowIndex == 0"
              style="vertical-align: top"
            >
              <ProsDayView
                :pros="byDay(dayIndex)"
                :diagnostic-mark="
                  selectedDiagnostic?.dayIndex.day == dayIndex
                    ? selectedDiagnostic.horaireIndex
                    : null
                "
              ></ProsDayView>
            </td>
          </tr>
        </tbody>
      </table>
    </v-col>

    <!-- diagnostics -->

    <v-col>
      <v-card subtitle="Diagnostics" class="mx-2 overflow-y-auto" height="80vh">
        <template #append>
          <v-btn icon size="small">
            <v-icon>mdi-help</v-icon>
            <v-menu activator="parent">
              <v-card
                title="Règles"
                subtitle="Les régles suivantes sont vérifiées."
              >
                <v-card-text>
                  <v-list lines="three" density="compact">
                    <v-list-item
                      v-for="rule in RulesDescription"
                      :title="rule[0]"
                      :subtitle="rule[1]"
                    ></v-list-item>
                  </v-list>
                </v-card-text>
              </v-card>
            </v-menu>
          </v-btn>
        </template>
        <v-card-text class="px-1">
          <v-list
            lines="three"
            density="compact"
            v-model="selectedDiagnosticIndex"
            select-strategy="single-leaf"
          >
            <v-list-item v-if="!props.diagnostics.length" class="text-center">
              <i>Aucun problème n'est détecté sur cette semaine.</i>
            </v-list-item>
            <v-list-item
              v-for="(diagnostic, index) in props.diagnostics"
              :title="diagnostic.message.title"
              :subtitle="diagnostic.message.message"
              :value="index"
              @click="selectedDiagnosticIndex = index"
              rounded
            >
              <template #append>
                <small class="text-muted ml-2">
                  {{
                    computeDate(
                      props.firstMonday,
                      diagnostic.dayIndex,
                      diagnostic.horaire
                    ).toLocaleString("fr", {
                      weekday: "short",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  }}
                </small>
              </template>
            </v-list-item>
          </v-list>
        </v-card-text>
      </v-card>
    </v-col>

    <!-- edit horaire -->
    <v-dialog
      :model-value="dayToEdit != null"
      @update:model-value="dayToEdit = null"
      max-width="800px"
    >
      <ProsDayHorairesEdit
        v-if="dayToEdit != null"
        :pros="byDay(dayToEdit)"
        @save="(v) => {
            emit('editHoraires', dayToEdit!, v); 
            dayToEdit = null;
        }"
      ></ProsDayHorairesEdit>
    </v-dialog>

    <!-- edit détachements -->
    <v-dialog v-model="showEditCreneaux" max-width="800px">
      <ProsSemaineSettingsEdit
        :first-monday="props.firstMonday"
        :planning="props.planning"
        @save="
          (r, d) => {
            emit('editMisc', r, d);
            showEditCreneaux = false;
          }
        "
      ></ProsSemaineSettingsEdit>
    </v-dialog>
  </v-row>
</template>

<script lang="ts" setup>
import ProsDayView from "./ProsDayView.vue";
import { computeDate, formatHoraire, TimeGrid, type int } from "@/logic/shared";
import { computed, ref } from "vue";
import ProsDayHorairesEdit from "./ProsDayHorairesEdit.vue";
import ProsSemaineSettingsEdit from "./ProsSemaineSettingsEdit.vue";
import type {
  Detachement,
  Diagnostic,
  HoraireTravail,
  Reunion,
  WeekPros,
} from "@/logic/types";

const props = defineProps<{
  firstMonday: Date;
  planning: WeekPros;
  diagnostics: Diagnostic[]; // restricted to the week
}>();

const emit = defineEmits<{
  (e: "editHoraires", dayIndex: int, horaires: HoraireTravail[]): void;
  (
    e: "editMisc",
    reunion: Reunion | null,
    detachements: (Detachement | null)[]
  ): void;
}>();

function byDay(day: int) {
  return props.planning.prosHoraires.map((pro) => ({
    pro: pro.pro,
    horaires: pro.horaires[day],
  }));
}

const selectedDiagnosticIndex = ref<int | null>(null);
const selectedDiagnostic = computed(() =>
  selectedDiagnosticIndex.value == null
    ? null
    : props.diagnostics[selectedDiagnosticIndex.value]
);

const dayToEdit = ref<int | null>(null);

const showEditCreneaux = ref(false);

/** This user-friendly list documents the various checks implemented by check.zig */
const RulesDescription = [
  [
    "Enfants 1",
    "Une pro seule doit avoir au maximum 3 enfants (marcheurs ou non).",
  ],
  [
    "Enfants 2",
    "A partir de deux pros, le maximum d’enfants par pro est 5 non-marcheurs ou 8 marcheurs. Un enfant marcheur peut compléter un groupe de non-marcheurs.",
  ],
  [
    "Détachement",
    "Une pro marquée en détachement ne peut pas s’occuper d’enfants.",
  ],
  [
    "Arrivée",
    "La première pro doit arriver 15 min avant le premier enfant, la deuxième pro 15 min avant le 4° enfant.",
  ],
  [
    "Départ",
    "L’avant-dernière pro doit partir 15 min après le 4° enfant restant, la dernière pro 30 min après le dernier enfant. ",
  ],
  ["Adaptation 1", "Une adaptation occupe une pro à part entière."],
  ["Adaptation 2", "Une adaptation doit se produire entre 9h et 17h."],
  [
    "Pause 1",
    "Chaque pro doit avoir entre 30 min et 1h de pause, à partir de 6h de travail.",
  ],
  [
    "Pause 2",
    "Pour strictement moins de 6h de travail, si l’arrivée est entre 11h et 12h, une pro doit avoir une pause.",
  ],
  [
    "Pause 3",
    "Pour une amplitude de 8h30 (ou plus), la pause est de 1h; pour 8h15, la pause est de 45min.",
  ],
  ["Pause 4", "Aucune pause entre 11h30 et 12h30 (à cause des repas)."],
  [
    "Réunion 1",
    "Toutes les pro (sauf congé) doivent être présentes sur le créneau de réunion hebdomadaire.",
  ],
  ["Réunion 2", "Sur ce créneau, les enfants sont considérés comme gardés."],

  [
    "Repos",
    "Il doit y avoir au moins 11h de repos entre la fin d’un service et le début du prochain.",
  ],
] as const;
</script>

<style></style>
