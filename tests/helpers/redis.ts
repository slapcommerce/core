import Redis from "ioredis";

export const redis = new Redis(process.env.REDIS_URL!);

export const redisStreamsResponseToObject = (
  response: [id: string, fields: string[]]
): Record<string, string> => {
  const result: Record<string, string> = {};
  result["redisMessageId"] = response[0];
  for (let i = 0; i < response[1].length; i += 2) {
    result[response[1][i]] = response[1][i + 1];
  }
  return result;
};
