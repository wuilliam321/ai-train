import { createApp } from "vue";
import App from "./App.vue";
import InitializationError from "./InitializationError.vue";
import "./styles.css";
import { createWebTrainingApplication } from "./training-application";

const mount = async (): Promise<void> => {
  const application = await createWebTrainingApplication();
  const target = document.querySelector<HTMLDivElement>("#app");

  if (target === null) {
    return;
  }

  if ("training" in application) {
    createApp(App, { training: application.training }).mount(target);
    return;
  }

  createApp(InitializationError, { initialization: application.initialization }).mount(target);
};

void mount();
