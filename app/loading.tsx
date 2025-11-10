import { LoadingSpinner } from '@/components/ui/loading-spinner';

export default function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm z-[9999]">
      <LoadingSpinner size="lg" text="Loading Page..." />
    </div>
  );
}
