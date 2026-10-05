import { getCompilationContract } from "@/lib/course-bundle";
import {
  claimImportJob,
  getCompilationProgress,
  getImportJob,
} from "@/lib/import-job-store";
import type { ImportJob } from "@/lib/import-jobs";

function withoutResult(job: ImportJob) {
  const summary: Partial<ImportJob> = { ...job };
  delete summary.resultBundle;
  return summary;
}

export async function prepareImportCompilation(jobId: string) {
  let job = await getImportJob(jobId);
  if (!job) throw new Error("Không tìm thấy import job.");

  if (job.status === "queued") {
    job = await claimImportJob(jobId);
  }

  if (!["processing", "ready", "consumed"].includes(job.status)) {
    throw new Error(
      "Import job chưa sẵn sàng để biên. Trạng thái hiện tại: " +
        job.status +
        ".",
    );
  }

  const progress = await getCompilationProgress(jobId);
  const contract = getCompilationContract(job.language);

  return {
    job: withoutResult(job),
    progress,
    contract,
    nextAction:
      job.status === "processing"
        ? "Resume only unfinished lessons from progress. Read source, checkpoint, save verified lesson drafts, then finalize_course_bundle."
        : "No compilation work is required for this job status.",
  };
}
