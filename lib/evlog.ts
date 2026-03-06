import { createEvlog } from "evlog/next"

export const { withEvlog, useLogger, log, createError } = createEvlog({
  service: "water-monitor",
  pretty: process.env.NODE_ENV === "development",
})
