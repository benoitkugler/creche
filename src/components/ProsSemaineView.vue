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
              :title="kindLabels[diagnostic.check.kind]"
              :subtitle="formatCheck(diagnostic.check)"
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
                      TimeGrid.indexToHoraire(diagnostic.horaireIndex)
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
          (v) => {
            emit('editDetachements', v);
            showEditCreneaux = false;
          }
        "
      ></ProsSemaineSettingsEdit>
    </v-dialog>
  </v-row>
</template>

<script lang="ts" setup>
import {
  type Detachement,
  type HoraireTravail,
  type PlanningProsSemaine,
} from "@/logic/pros";
import ProsDayView from "./ProsDayView.vue";
import { computeDate, formatHoraire, type int } from "@/logic/shared";
import {
  formatCheck,
  RulesDescription,
  TimeGrid,
  type Diagnostic,
} from "@/logic/check";
import { computed, ref } from "vue";
import ProsDayHorairesEdit from "./ProsDayHorairesEdit.vue";
import ProsSemaineSettingsEdit from "./ProsSemaineSettingsEdit.vue";

const props = defineProps<{
  firstMonday: Date;
  planning: PlanningProsSemaine;
  diagnostics: Diagnostic[]; // restricted to the week
}>();

const emit = defineEmits<{
  (e: "editHoraires", dayIndex: int, horaires: HoraireTravail[]): void;
  (e: "editDetachements", detachements: (Detachement | undefined)[]): void;
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
const kindLabels = [
  "Adaptation",
  "Nombre d'enfants",
  "Réunion hebdomadaire",
  "Temps de repos",
  "Pause manquante",
  "Durée de la pause",
  "Horaires de la pause",
  "Départ ou arrivée d'une pro.",
  "Horaires d'une adaptation",
  "Roulement",
] as const;

const dayToEdit = ref<int | null>(null);

const showEditCreneaux = ref(false);
</script>

<style></style>
