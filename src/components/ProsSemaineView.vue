<template>
  <v-row justify="center" no-gutters class="mt-1">
    <v-col cols="auto">
      <ProsDayHorairesHeader></ProsDayHorairesHeader>
    </v-col>
    <v-col cols="auto">
      <ProsDayView
        :pros="byDay(0)"
        :day="
          computeDate(props.firstMonday, {
            week: props.planning.week,
            day: 0,
          })
        "
      ></ProsDayView>
    </v-col>
    <v-col cols="auto">
      <ProsDayView
        :pros="byDay(1)"
        :day="
          computeDate(props.firstMonday, {
            week: props.planning.week,
            day: 1,
          })
        "
      ></ProsDayView>
    </v-col>
    <v-col cols="auto">
      <ProsDayView
        :pros="byDay(2)"
        :day="
          computeDate(props.firstMonday, {
            week: props.planning.week,
            day: 2,
          })
        "
      ></ProsDayView>
    </v-col>
    <v-col cols="auto">
      <ProsDayView
        :pros="byDay(3)"
        :day="
          computeDate(props.firstMonday, {
            week: props.planning.week,
            day: 3,
          })
        "
      ></ProsDayView>
    </v-col>
    <v-col cols="auto">
      <ProsDayView
        :pros="byDay(4)"
        :day="
          computeDate(props.firstMonday, {
            week: props.planning.week,
            day: 4,
          })
        "
      ></ProsDayView>
    </v-col>

    <!-- diagnostics -->

    <v-col>
      <v-card subtitle="Diagnostics" class="mx-2">
        <v-card-text class="px-1">
          <v-list lines="three" density="compact">
            <v-list-item v-if="!props.diagnostics.length" class="text-center">
              <i>Aucun problème n'est détecté sur cette semaine.</i>
            </v-list-item>
            <v-list-item
              v-for="diagnostic in props.diagnostics"
              :title="kindLabels[diagnostic.check.kind]"
              :subtitle="formatCheck(diagnostic.check)"
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
  </v-row>
</template>

<script lang="ts" setup>
import { type PlanningProsSemaine } from "@/logic/personnel";
import ProsDayView from "./ProsDayView.vue";
import { computeDate, formatHoraire, type int } from "@/logic/shared";
import ProsDayHorairesHeader from "./ProsDayHorairesHeader.vue";
import {
  CheckKind,
  TimeGrid,
  type Check,
  type Diagnostic,
} from "@/logic/check";

const props = defineProps<{
  firstMonday: Date;
  planning: PlanningProsSemaine;
  diagnostics: Diagnostic[]; // restricted to the week
}>();

const emit = defineEmits<{}>();

function byDay(day: int) {
  return props.planning.prosHoraires.map((pro) => ({
    pro: pro.pro,
    horaires: pro.horaires[day],
  }));
}

const kindLabels = [
  "Adaptation",
  "Nombre d'enfants",
  "Réunion hebdomadaire",
  "Temps de repos",
] as const;

function formatCheck(check: Check): string {
  switch (check.kind) {
    case CheckKind.MissingProAdaption:
      return `Pro. manquante pour les adaptations (requises: ${check.expect}, présentes: ${check.got}).`;
    case CheckKind.MissingProForEnfants:
      return `Pro. manquante pour le nombre d'enfants (requises: ${check.expect}, présentes: ${check.got}).`;
    case CheckKind.MissingProAtReunion:
      return `Pro. manquante sur le créneau de réunion (requises: ${check.expect}, présentes: ${check.got}).`;
    case CheckKind.NotEnoughSleep:
      return `Temps de repos insuffisant pour ${
        check.pro.prenom
      } : reprise le lendemain à ${formatHoraire(
        check.gotLendemain
      )} au lieu de ${formatHoraire(check.expectedLendemain)}`;
  }
}
</script>

<style></style>
