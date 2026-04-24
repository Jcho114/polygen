// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "polygen-attempt-3",
      providers: {
        aws: {
          profile: "adc-admin-dev",
        },
      },
      removal: input?.stage === "production" ? "retain" : "remove",
      protect: ["production"].includes(input?.stage),
      home: "aws",
    };
  },
  async run() {
    await import("./infra/api.ts");
    await import("./infra/web.ts");
  },
});
