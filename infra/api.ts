export const api = new sst.aws.ApiGatewayV2("Api", {
  cors: {
    allowOrigins: ["*"],
    allowHeaders: ["*"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  },
});

const openAiApiKey = new sst.Secret("OpenAIApiKey");

const apiHandler = {
  handler: "api/lambda.handler",
  link: [openAiApiKey],
};

api.route("ANY /api", apiHandler);
api.route("ANY /api/{proxy+}", apiHandler);
