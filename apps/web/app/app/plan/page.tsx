import { PricingGrid } from '@/components/PricingGrid';
import { PreviewBanner } from '@/components/PreviewBanner';

export default function PlanPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Plan & billing</h1>
          <p className="muted">You are on the Free plan: 5 thesis checks per day.</p>
        </div>
      </div>
      <PreviewBanner>Paid plans are planned for launch after the hackathon. No payment is taken.</PreviewBanner>
      <PricingGrid currentPlan="Free" />
    </>
  );
}
