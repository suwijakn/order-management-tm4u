<script setup>
import { RouterView } from "vue-router";
import ErrorBoundary from "@/components/ErrorBoundary.vue";
</script>

<template>
  <ErrorBoundary>
    <RouterView />
  </ErrorBoundary>
</template>

<style scoped>
/* App-level styles can go here */
</style>
