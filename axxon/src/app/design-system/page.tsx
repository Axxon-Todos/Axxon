// Exposes the reusable UI reference in development without publishing an internal showcase.
import { notFound } from 'next/navigation';
import DesignSystemShowcase from '@/components/features/designSystem/DesignSystemShowcase';

// Restricts the live component reference to local development and test runs.
export default function DesignSystemPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <DesignSystemShowcase />;
}
