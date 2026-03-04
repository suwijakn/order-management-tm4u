import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import { createPersistPlugin } from "./plugins/piniaPersist";
import "./assets/main.css";

const app = createApp(App);

const pinia = createPinia();

// Add persistence plugin for orders and columns stores
pinia.use(
  createPersistPlugin({
    stores: ["orders", "columns"],
    paths: ["orders", "currentMonth", "definitions", "permissions"],
  }),
);

app.use(pinia);
app.use(router);

app.mount("#app");
