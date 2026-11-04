export default function WorkflowSteps({ label, steps, current }) {
  return <ol className="workflow-steps" aria-label={label}>{steps.map((step, index) => <li key={step} aria-current={index === current ? 'step' : undefined} data-complete={index < current || undefined}><span aria-hidden="true">{index < current ? '✓' : index + 1}. </span>{step}</li>)}</ol>;
}
