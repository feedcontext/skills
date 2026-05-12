import { join } from "node:path";
import { evalsRoot } from "./lib/common.mjs";
import { runOfflineCase } from "./run-offline.mjs";

export default class FeedContextSkillEvalProvider {
  constructor(options = {}) {
    this.providerId = options.id || "feedcontext-skill-independent-agent";
    this.config = options.config || {};
  }

  id() {
    return this.providerId;
  }

  async callApi(_prompt, context = {}) {
    const caseId = context.vars?.case_id || this.config.case_id || "structured-synthesis-basic";
    const caseDir = join(evalsRoot, "cases", String(caseId));
    const summary = await runOfflineCase({
      caseDir,
      matrixLabel: context.vars?.matrix_label ? String(context.vars.matrix_label) : null,
      model: context.vars?.codex_model ? String(context.vars.codex_model) : null,
      profile: context.vars?.codex_profile ? String(context.vars.codex_profile) : null,
    });
    return {
      output: summary.success ? "pass" : "fail",
      metadata: {
        case_id: summary.case_id,
        lane: summary.lane,
        matrix_label: summary.matrix_label,
        model: summary.model,
        profile: summary.profile,
        output_dir: summary.output_dir,
        contract_report_file: summary.contract_report_file,
        failure_packet_file: summary.failure_packet_file,
      },
    };
  }
}
