import Bottleneck from "bottleneck";

export const chatLimiter = new Bottleneck({
  maxConcurrent: 3,
  minTime: 500,
});

export const backgroundLimiter = new Bottleneck({
  maxConcurrent: 1,
  minTime: 2000,
});
