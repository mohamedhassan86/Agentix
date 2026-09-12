export interface IConfig {
  app: {
    env: "development" | "production" | "test";
    origin?: string | null;
  };
  foundation: {
    demoEnabled: boolean;
  };
}
