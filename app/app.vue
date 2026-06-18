<script setup lang="ts">
const { t } = useI18n()
useHead({ title: () => t('app.title') })
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtPage />
  </div>
</template>
