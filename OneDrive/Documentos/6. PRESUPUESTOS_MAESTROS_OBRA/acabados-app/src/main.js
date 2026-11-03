import { createApp } from 'vue'
import App from './App.vue'
import { registerSW } from 'virtual:pwa-register'

// Registra y actualiza el Service Worker automáticamente
registerSW({ immediate: true })

createApp(App).mount('#app')