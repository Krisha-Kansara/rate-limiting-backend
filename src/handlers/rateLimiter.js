import "dotenv/config";

import { getUsage, saveUsage } from "../services/dynamoService.js";

import {
  LIMIT,
  WINDOW_SECONDS,
} from "../config/constants.js";
const corsHeaders = {
  "Access-Control-Allow-Origin":
    "https://rate-limiting-frontend.vercel.app",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

export const handler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");

    const apiKey = body.apiKey;

    if (!apiKey) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          message: "apiKey is required",
        }),
      };
    }

    const now = Math.floor(Date.now() / 1000);

    const record = await getUsage(apiKey);

    // First request
    if (!record) {
      await saveUsage({
        apiKey,
        requestCount: 1,
        windowStart: now,
      });

      return {
        statusCode: 200,
        headers: corsHeaders,  
        body: JSON.stringify({
          allowed: true,
          remaining: LIMIT - 1,
        }),
      };
    }

    // Window expired
    if (
      now - record.windowStart >=
      WINDOW_SECONDS
    ) {
      await saveUsage({
        apiKey,
        requestCount: 1,
        windowStart: now,
      });

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({
          allowed: true,
          remaining: LIMIT - 1,
        }),
      };
    }

    // Limit exceeded
    if (record.requestCount >= LIMIT) {
      return {
        statusCode: 429,
        headers: corsHeaders,
        body: JSON.stringify({
          allowed: false,
          message: "Rate limit exceeded!",
        }),
      };
    }

    const updatedRecord = {
      ...record,
      requestCount:
        record.requestCount + 1,
    };

    await saveUsage(updatedRecord);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        allowed: true,
        remaining:
          LIMIT -
          updatedRecord.requestCount,
      }),
    };
  } catch (error) {
    console.error(error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: "Internal server error",
      }),
    };
  }
};