"use client";

import { use } from "react";
import { WorkflowEditor } from "@/components/workflow/workflow-editor";

export default function EditWorkflowPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <WorkflowEditor workflowId={id} />;
}
