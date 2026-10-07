import { inngest } from "./client.js";
import { listPendingIds } from "../data/imagesRepo.js";
import { tagImage } from "../logic/tagImage.js";

const STOP_OUTCOMES = new Set(["quota_stopped", "budget_stopped"]);

export const processImages = inngest.createFunction(
  {
    id: "process-images",
    concurrency: 1,
    retries: 2,
    onFailure: async ({ error }) => {
      console.error(`ALERT process-images failed: ${error.message}`);
    },
  },
  { event: "images/process.requested" },
  async ({ step }) => {
    const ids = await step.run("list-pending", () => listPendingIds());
    const summary = { total: ids.length, tagged: 0, flagged: 0, failed: 0, other: 0, stoppedEarly: null };

    for (const id of ids) {
      const result = await step.run(`tag-${id}`, async () => {
        const out = await tagImage(id);
        return { imageId: out.imageId, outcome: out.outcome };
      });
      if (STOP_OUTCOMES.has(result.outcome)) {
        summary.stoppedEarly = result.outcome;
        console.error(`ALERT process-images stopped early: ${result.outcome}`);
        break;
      }
      if (result.outcome in summary) summary[result.outcome]++;
      else summary.other++;
    }

    return summary;
  }
);
