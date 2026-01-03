// Placeholder SQS email worker.
// TODO: send emails via SES, write send logs to DB
export async function handler(event) {
  console.log("SQS batch:", JSON.stringify(event));
  return {};
}
