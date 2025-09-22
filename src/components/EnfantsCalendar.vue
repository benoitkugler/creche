<template>
    <v-card title="Planning des enfants" :subtitle="month + ' ' + props.planning.firstMonday.getFullYear()">
        <table>
            <tr>
                <th>Enfant</th>
                <th>Marcheur ?</th>
                <th v-for="day in days">{{ day }}</th>
            </tr>
        </table>
    </v-card>
</template>

<script lang="ts" setup>
import { ref, onMounted, computed } from "vue"
import { type PlanningEnfants, months } from "@/logic/enfants"

const props = defineProps<{ planning: PlanningEnfants }>()

const month = computed(() => months[props.planning.firstMonday.getMonth()]!.toUpperCase())

const days = computed(() => {

})
</script>
