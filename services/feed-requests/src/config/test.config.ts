import { Environment, EnvironmentVariables, validateConfig } from './validate';

export function testConfig(): EnvironmentVariables {
  const vals: EnvironmentVariables = {
    NODE_ENV: Environment.Test,
    FEED_REQUESTS_POSTGRES_URI: 'postgres://localhost:5432/test',
    FEED_REQUESTS_FAILED_REQUEST_DURATION_THRESHOLD_HOURS: 36,
    FEED_REQUESTS_API_KEY: '123456789',
    FEED_REQUESTS_API_PORT: 3000,
    FEED_REQUESTS_RABBITMQ_BROKER_URL: 'amqp://localhost:5672',
  };

  validateConfig(vals);

  return vals;
}