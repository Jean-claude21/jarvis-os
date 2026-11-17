import { Empty, PageHead, Panel } from '../ui';

// A screen whose turn has not come: said plainly, with the step that brings it.
export function Soon({ title, lead, step }: { title: string; lead: string; step: string }) {
  return (
    <>
      <PageHead title={title} lead={lead} />
      <Panel>
        <Empty title={`Arrive avec ${step}`} lead="En attendant, l’ancien écran reste sur /app." />
      </Panel>
    </>
  );
}
