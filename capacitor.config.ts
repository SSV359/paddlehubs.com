import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.paddlehubs.app",
  appName: "PaddleHubs",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
